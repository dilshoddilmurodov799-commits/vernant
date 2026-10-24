-- =============================================================================
-- 0002 — phone-first onboarding, profile photos, discovery preferences, matches,
-- post media, conversation RPC, tighter RLS.
-- STATUS: DRAFT, like 0001. Apply after 0001, then run supabase/tests (pgTAP).
--
-- Non-destructive: no table or column that holds data is dropped. Policies,
-- functions and triggers are replaced in place; constraints are only added or
-- relaxed (reports.reporter_id now survives account deletion).
-- =============================================================================

create type public.moderation_status as enum ('pending', 'approved', 'rejected');

-- Short tags (identities, interests, intents): 1–40 characters each.
create function public.valid_tags(tags text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(char_length(t) between 1 and 40), true) from unnest(tags) as t;
$$;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Profiles: onboarding state
-- Phone sign-ups create the auth user before a username exists, so the profile row
-- is created by save_account() during onboarding instead of an auth.users trigger.
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.profiles
  add column onboarding_step smallint not null default 0 check (onboarding_step between 0 and 3),
  add column onboarded_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint profiles_tags_check check (
    public.valid_tags(identities) and public.valid_tags(looking_for) and public.valid_tags(interests)
    and cardinality(identities) <= 20 and cardinality(looking_for) <= 10
  ),
  -- citext's `~` ignores case; usernames are stored lowercase.
  drop constraint profiles_username_check,
  add constraint profiles_username_check check (username::text ~ '^[a-z0-9._]{3,30}$');

comment on column public.profiles.onboarding_step is 'Onboarding screens finished: 1 account, 2 profile, 3 preferences.';
comment on column public.profiles.onboarded_at is 'Set only by complete_onboarding(). Unfinished accounts can''t browse, be seen, or write social data.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profile_private
  add column terms_accepted_at timestamptz,
  add column terms_version text check (char_length(terms_version) between 1 and 40);

-- Members never insert profile rows themselves: save_account() does, after phone verification.
drop policy "insert own profile" on public.profiles;

-- `verified` (moderation), `onboarded_at` (complete_onboarding) and `avatar_path` (set when
-- an approved photo becomes primary) are server-managed. Column-level REVOKE is ineffective
-- while table-level UPDATE is granted, so enforce with a trigger. Replaces protect_verified.
drop trigger profiles_protect_verified on public.profiles;
drop function public.protect_verified();

create function public.protect_profile_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.id is distinct from old.id
    or new.verified is distinct from old.verified
    or new.onboarded_at is distinct from old.onboarded_at
    or new.avatar_path is distinct from old.avatar_path
  ) then
    raise exception 'This field is managed by the server' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger profiles_protect_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- -----------------------------------------------------------------------------
-- Discovery preferences (owner-only)
-- -----------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  interested_in text[] not null default '{}' check (cardinality(interested_in) <= 20 and public.valid_tags(interested_in)),
  age_min smallint not null default 18 check (age_min between 18 and 99),
  age_max smallint not null default 99 check (age_max between 18 and 99),
  max_distance_km smallint check (max_distance_km between 1 and 500),  -- null: any distance
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_min <= age_max)
);

create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Onboarding RPCs
-- -----------------------------------------------------------------------------
create function public.is_onboarded(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and onboarded_at is not null);
$$;

create function public.has_verified_phone(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = uid and phone_confirmed_at is not null);
$$;
revoke execute on function public.has_verified_phone(uuid) from public, anon, authenticated;

-- Account step: claims the username and records consent to the Terms and Privacy Policy.
-- Keyed on auth.uid(), so retries and refreshes update the same row. A taken username raises
-- unique_violation (23505), a malformed one check_violation (23514).
create function public.save_account(p_username text, p_terms_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.has_verified_phone(uid) then
    raise exception 'Verify your phone number first' using errcode = 'insufficient_privilege';
  end if;
  if p_terms_version is null or char_length(p_terms_version) not between 1 and 40 then
    raise exception 'Accept the Terms and Privacy Policy' using errcode = 'check_violation';
  end if;

  insert into public.profiles as p (id, username, onboarding_step)
  values (uid, lower(trim(p_username)), 1)
  on conflict (id) do update
    set username = excluded.username, onboarding_step = greatest(p.onboarding_step, 1);

  insert into public.profile_private (user_id, terms_accepted_at, terms_version)
  values (uid, now(), p_terms_version)
  on conflict (user_id) do update
    set terms_accepted_at = now(), terms_version = excluded.terms_version;
end $$;

-- Live availability hint for the account step. The unique constraint is the real guard.
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(trim(p_username)) ~ '^[a-z0-9._]{3,30}$' and not exists (
    select 1 from public.profiles
    where lower(username::text) = lower(trim(p_username)) and id is distinct from auth.uid()
  );
$$;

-- Marks onboarding done once the account step is complete. Idempotent.
create function public.complete_onboarding() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  done timestamptz;
begin
  if uid is null or not public.has_verified_phone(uid) or not exists (
    select 1 from public.profile_private where user_id = uid and terms_accepted_at is not null
  ) then
    raise exception 'Finish account setup first' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.profiles
  set onboarded_at = coalesce(onboarded_at, now()), onboarding_step = 3
  where id = uid
  returning onboarded_at into done;

  insert into public.user_preferences (user_id) values (uid) on conflict (user_id) do nothing;
  return done;
end $$;

revoke execute on function public.save_account(text, text) from public, anon;
revoke execute on function public.username_available(text) from public, anon;
revoke execute on function public.complete_onboarding() from public, anon;
grant execute on function public.save_account(text, text) to authenticated;
grant execute on function public.username_available(text) to authenticated;
grant execute on function public.complete_onboarding() to authenticated;

-- Username → account email or phone for password log-in. Service role only: the sign-in
-- server action hands the result straight to Auth, so neither reaches clients. Phone-first
-- accounts have no email. Replaces login_email.
drop function if exists public.login_email(text);

create function public.login_identity(p_username text) returns table (email text, phone text)
language sql stable security definer set search_path = '' as $$
  select u.email::text, u.phone::text
  from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username::text) = lower(trim(p_username));
$$;
revoke execute on function public.login_identity(text) from public, anon, authenticated;
grant execute on function public.login_identity(text) to service_role;

-- -----------------------------------------------------------------------------
-- Matches: written only by triggers, from mutual profile likes
-- -----------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index matches_user_b on public.matches (user_b);

create or replace function public.is_match(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.matches where user_a = least(a, b) and user_b = greatest(a, b));
$$;

create function public.sync_match() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  lo uuid;
  hi uuid;
begin
  if tg_op = 'INSERT' then
    lo := least(new.liker_id, new.likee_id);
    hi := greatest(new.liker_id, new.likee_id);
    -- Serialize both halves of a mutual like so two simultaneous likes still match.
    perform pg_advisory_xact_lock(hashtextextended(lo::text || hi::text, 0));
    if exists (select 1 from public.profile_likes where liker_id = new.likee_id and likee_id = new.liker_id) then
      insert into public.matches (user_a, user_b) values (lo, hi) on conflict (user_a, user_b) do nothing;
    end if;
    return new;
  end if;
  -- Taking back a like (or a block, below) ends the match.
  delete from public.matches
  where user_a = least(old.liker_id, old.likee_id) and user_b = greatest(old.liker_id, old.likee_id);
  return old;
end $$;

create trigger profile_likes_sync_match after insert or delete on public.profile_likes
  for each row execute function public.sync_match();

-- Blocking ends the connection both ways: likes (and with them the match), follows,
-- and private album grants.
create function public.end_connection_on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.profile_likes
  where (liker_id = new.blocker_id and likee_id = new.blocked_id)
     or (liker_id = new.blocked_id and likee_id = new.blocker_id);
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.private_album_grants
  where (owner_id = new.blocker_id and viewer_id = new.blocked_id)
     or (owner_id = new.blocked_id and viewer_id = new.blocker_id);
  return new;
end $$;

create trigger blocks_end_connection after insert on public.blocks
  for each row execute function public.end_connection_on_block();

-- Both sides must have finished onboarding to see each other, so half-made accounts can't
-- browse members or be found.
create or replace function public.can_view_profile(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = owner or (
    public.is_onboarded(viewer) and public.is_onboarded(owner) and
    not public.is_blocked(viewer, owner) and
    case (select visibility from public.profiles where id = owner)
      when 'everyone' then true
      when 'members' then public.is_connected(viewer, owner) or public.is_match(viewer, owner)
      when 'matches' then public.is_match(viewer, owner)
      else false
    end
  );
$$;

-- -----------------------------------------------------------------------------
-- Profile photos and post media. Rows are inserted by the server (service role) after
-- it validates type and size, strips EXIF/GPS and stores the re-encoded file. They start
-- `pending` and only `approved` media is visible to anyone but the owner.
-- -----------------------------------------------------------------------------
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (storage_path like (user_id::text || '/%')),
  sort_order smallint not null default 0 check (sort_order between 0 and 8),  -- 0 = primary
  status public.moderation_status not null default 'pending',
  width int check (width between 1 and 10000),
  height int check (height between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sort_order)
);

create trigger profile_photos_updated_at before update on public.profile_photos
  for each row execute function public.set_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 9),
  status public.moderation_status not null default 'pending',
  width int check (width between 1 and 10000),
  height int check (height between 1 and 10000),
  created_at timestamptz not null default now(),
  unique (post_id, sort_order)
);

-- Media now lives in post_media; posts may be text-only.
alter table public.posts drop constraint if exists posts_media_paths_check;
comment on column public.posts.media_paths is 'Deprecated: use post_media.';

-- Stories are moderated like other media.
alter table public.stories add column status public.moderation_status not null default 'pending';

-- -----------------------------------------------------------------------------
-- Conversations: the only way to create one. Opens (or returns) the 1:1 conversation
-- with `p_other` if their messaging setting allows it.
-- -----------------------------------------------------------------------------
create function public.start_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  allowed public.visibility;
  conv uuid;
begin
  if uid is null or p_other is null or uid = p_other or not public.can_view_profile(uid, p_other) then
    raise exception 'You can''t message this member' using errcode = 'insufficient_privilege';
  end if;
  select allow_messages_from into allowed from public.profiles where id = p_other;
  if not (public.is_match(uid, p_other)
          or allowed = 'everyone'
          or (allowed = 'members' and public.is_connected(uid, p_other))) then
    raise exception 'You can''t message this member' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(uid, p_other)::text || greatest(uid, p_other)::text, 1));
  select a.conversation_id into conv
  from public.conversation_members a
  join public.conversation_members b on b.conversation_id = a.conversation_id and b.user_id = p_other
  where a.user_id = uid
    and (select count(*) from public.conversation_members c where c.conversation_id = a.conversation_id) = 2
  limit 1;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, uid), (conv, p_other);
  end if;
  return conv;
end $$;
revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reports outlive the reporter's account so moderation keeps its audit trail.
-- -----------------------------------------------------------------------------
alter table public.reports
  alter column reporter_id drop not null,
  drop constraint reports_reporter_id_fkey,
  add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Indexes for foreign keys and hot lookups not covered by primary keys
-- -----------------------------------------------------------------------------
create index blocks_blocked on public.blocks (blocked_id);
create index follows_followee on public.follows (followee_id);
create index profile_likes_likee on public.profile_likes (likee_id);
create index post_likes_user on public.post_likes (user_id);
create index comments_post on public.comments (post_id, created_at);
create index comments_author on public.comments (author_id);
create index stories_user_expiry on public.stories (user_id, expires_at desc);
create index conversation_members_user on public.conversation_members (user_id);
create index messages_sender on public.messages (sender_id);
create index private_album_grants_viewer on public.private_album_grants (viewer_id);
create index reports_queue on public.reports (status, created_at);
create index reports_reporter on public.reports (reporter_id);
create index notifications_actor on public.notifications (actor_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.user_preferences enable row level security;
alter table public.matches enable row level security;
alter table public.profile_photos enable row level security;
alter table public.post_media enable row level security;

create policy "own preferences" on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- No insert/update/delete policies: matches come only from sync_match().
create policy "see own matches" on public.matches for select to authenticated
  using ((select auth.uid()) in (user_a, user_b) and not public.is_blocked(user_a, user_b));

create policy "view own or approved visible photos" on public.profile_photos for select to authenticated
  using (user_id = (select auth.uid())
         or (status = 'approved' and public.can_view_profile((select auth.uid()), user_id)));
create policy "remove own photos" on public.profile_photos for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "view media on visible posts" on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p
                 where p.id = post_media.post_id
                   and (p.author_id = (select auth.uid()) or post_media.status = 'approved')));
create policy "author removes post media" on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_media.post_id and p.author_id = (select auth.uid())));

-- Unfinished accounts can't write social content. (Follows, likes, comments and post likes
-- already require can_view_profile / a visible post, which now require onboarding.)
alter policy "author writes posts" on public.posts
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and public.is_onboarded((select auth.uid())));

alter policy "view live permitted stories" on public.stories
  using (user_id = (select auth.uid())
         or (status = 'approved' and expires_at > now() and public.can_view_profile((select auth.uid()), user_id)));
-- Owners can't approve their own stories; any edit goes back to moderation.
alter policy "owner manages stories" on public.stories
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'pending' and public.is_onboarded((select auth.uid())));

alter policy "members send when not blocked" on public.messages
  with check (sender_id = (select auth.uid())
              and public.is_onboarded(sender_id)
              and public.is_conversation_member(conversation_id, sender_id)
              and public.conversation_unblocked(conversation_id, sender_id));

alter policy "request access" on public.private_album_grants
  with check (viewer_id = (select auth.uid()) and status = 'requested'
              and public.can_view_profile(viewer_id, owner_id));

-- -----------------------------------------------------------------------------
-- Storage. Uploads go through the server (service role), which validates, strips
-- metadata and queues moderation, so clients get no INSERT policy on media buckets.
-- Readers get an object only when it backs content they may see; pending or rejected
-- uploads stay owner-only even if someone learns the path.
-- -----------------------------------------------------------------------------
drop policy "upload to own folder" on storage.objects;
drop policy "read media of viewable profiles" on storage.objects;

create function public.can_read_media(viewer uuid, path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_photos ph
                 where ph.storage_path = path and ph.status = 'approved'
                   and public.can_view_profile(viewer, ph.user_id))
      or exists (select 1 from public.post_media pm join public.posts p on p.id = pm.post_id
                 where pm.storage_path = path and pm.status = 'approved'
                   and public.can_view_post(viewer, p.author_id, p.audience))
      or exists (select 1 from public.stories s
                 where s.media_path = path and s.status = 'approved' and s.expires_at > now()
                   and public.can_view_profile(viewer, s.user_id));
$$;
revoke execute on function public.can_read_media(uuid, text) from public, anon;
grant execute on function public.can_read_media(uuid, text) to authenticated;

create policy "read own or visible media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.can_read_media((select auth.uid()), name)
  ));
