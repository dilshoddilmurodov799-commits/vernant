-- =============================================================================
-- Hearth — initial schema + Row Level Security
-- STATUS: DRAFT. Not applied anywhere. Review, then cover with pgTAP/RLS tests
-- (supabase test db) before connecting real user data.
--
-- Principles
--   * RLS is enabled on every table; no table is readable by `anon`.
--   * Clients use the publishable key + user JWT only. The service-role key is used
--     solely by server-side moderation/admin jobs and is never shipped to browsers.
--   * Blocking is symmetric and enforced in the database, not the UI.
--   * Birth dates are never selectable by other users; only derived age is.
--   * Media lives in PRIVATE buckets and is served through short-lived signed URLs.
-- =============================================================================

create extension if not exists citext;

create type public.visibility as enum ('everyone', 'members', 'matches');
create type public.post_audience as enum ('public', 'followers');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.album_grant_status as enum ('requested', 'approved', 'revoked');

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  pronouns text check (char_length(pronouns) <= 30),
  bio text not null default '' check (char_length(bio) <= 300),
  city text check (char_length(city) <= 60),
  -- Coarse location only (e.g. rounded to ~1 km) — never store precise GPS.
  approx_lat numeric(6, 3),
  approx_lng numeric(6, 3),
  identities text[] not null default '{}',
  looking_for text[] not null default '{}',
  interests text[] not null default '{}' check (cardinality(interests) <= 15),
  avatar_path text,
  verified boolean not null default false,          -- set only by moderation (service role)
  visibility public.visibility not null default 'members',
  allow_messages_from public.visibility not null default 'members',
  show_distance boolean not null default true,
  show_online boolean not null default true,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Private per-user data. Owner-only.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date not null,
  incognito boolean not null default false,
  blur_incoming_media boolean not null default true,
  private_album_access text not null default 'approved' check (private_album_access in ('approved', 'matches'))
);

-- 18+ enforcement at the database layer (client checks are UX only).
create function public.enforce_adult() returns trigger
language plpgsql as $$
begin
  if new.birth_date > (current_date - interval '18 years') then
    raise exception 'Members must be 18 or older' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger profile_private_adult
  before insert or update of birth_date on public.profile_private
  for each row execute function public.enforce_adult();

-- -----------------------------------------------------------------------------
-- Social graph
-- -----------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- Profile likes; a match is a mutual like.
create table public.profile_likes (
  liker_id uuid not null references public.profiles (id) on delete cascade,
  likee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, likee_id),
  check (liker_id <> likee_id)
);

-- -----------------------------------------------------------------------------
-- Helper predicates. SECURITY DEFINER so they can read across RLS safely;
-- empty search_path prevents search-path hijacking.
-- -----------------------------------------------------------------------------
create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.is_match(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_likes where liker_id = a and likee_id = b)
     and exists (select 1 from public.profile_likes where liker_id = b and likee_id = a);
$$;

create function public.is_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.follows
    where (follower_id = a and followee_id = b) or (follower_id = b and followee_id = a)
  );
$$;

create function public.can_view_profile(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = owner or (
    not public.is_blocked(viewer, owner) and
    case (select visibility from public.profiles where id = owner)
      when 'everyone' then true
      when 'members' then public.is_connected(viewer, owner) or public.is_match(viewer, owner)
      when 'matches' then public.is_match(viewer, owner)
      else false
    end
  );
$$;

-- Age without exposing birth date.
create function public.profile_age(profile_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select extract(year from age(birth_date))::int from public.profile_private where user_id = profile_id;
$$;

-- -----------------------------------------------------------------------------
-- Posts, comments, stories
-- -----------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 500),
  audience public.post_audience not null default 'public',
  media_paths text[] not null default '{}' check (cardinality(media_paths) between 1 and 10),
  created_at timestamptz not null default now()
);
create index on public.posts (author_id, created_at desc);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  caption text check (char_length(caption) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create function public.can_view_post(viewer uuid, author uuid, aud public.post_audience) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = author or (
    public.can_view_profile(viewer, author) and
    (aud = 'public' or exists (
      select 1 from public.follows where follower_id = viewer and followee_id = author
    ))
  );
$$;

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted boolean not null default false,
  pinned boolean not null default false,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 2000),
  media_path text,
  created_at timestamptz not null default now(),
  check (body is not null or media_path is not null)
);
create index on public.messages (conversation_id, created_at);

create function public.is_conversation_member(conv uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = uid);
$$;

-- True when no member of the conversation has blocked/been blocked by `uid`.
create function public.conversation_unblocked(conv uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.user_id <> uid and public.is_blocked(uid, m.user_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Private albums, reports, notifications
-- -----------------------------------------------------------------------------
create table public.private_album_grants (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  status public.album_grant_status not null default 'requested',
  updated_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create function public.has_album_access(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = owner or (
    not public.is_blocked(viewer, owner) and (
      exists (select 1 from public.private_album_grants
              where owner_id = owner and viewer_id = viewer and status = 'approved')
      or (
        (select private_album_access from public.profile_private where user_id = owner) = 'matches'
        and public.is_match(viewer, owner)
      )
    )
  );
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_post_id uuid references public.posts (id) on delete set null,
  target_message_id uuid references public.messages (id) on delete set null,
  reason text not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.blocks enable row level security;
alter table public.follows enable row level security;
alter table public.profile_likes enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.private_album_grants enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

-- Profiles
create policy "view permitted profiles" on public.profiles for select to authenticated
  using (public.can_view_profile((select auth.uid()), id));
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and verified = false);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- `verified` must only change via moderation (service role). Column-level REVOKE
-- is ineffective while table-level UPDATE is granted, so enforce with a trigger.
create function public.protect_verified() returns trigger
language plpgsql as $$
begin
  if new.verified is distinct from old.verified and current_user in ('authenticated', 'anon') then
    raise exception 'verified can only be changed by moderation' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger profiles_protect_verified before update on public.profiles
  for each row execute function public.protect_verified();

create policy "own private row" on public.profile_private for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Blocks: only the blocker sees/manages their blocks.
create policy "manage own blocks" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- Follows
create policy "see own follow edges" on public.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));
create policy "follow visible members" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and public.can_view_profile(follower_id, followee_id));
create policy "unfollow" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- Likes: you see likes you gave and likes you received (for "Likes you").
create policy "see own likes" on public.profile_likes for select to authenticated
  using ((select auth.uid()) in (liker_id, likee_id) and not public.is_blocked(liker_id, likee_id));
create policy "like visible members" on public.profile_likes for insert to authenticated
  with check (liker_id = (select auth.uid()) and public.can_view_profile(liker_id, likee_id));
create policy "unlike" on public.profile_likes for delete to authenticated
  using (liker_id = (select auth.uid()));

-- Posts
create policy "view permitted posts" on public.posts for select to authenticated
  using (public.can_view_post((select auth.uid()), author_id, audience));
create policy "author writes posts" on public.posts for all to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy "view likes on visible posts" on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "like visible posts" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "unlike posts" on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "view comments on visible posts" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id)
         and not public.is_blocked((select auth.uid()), author_id));
create policy "comment on visible posts" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "delete own comment or comment on own post" on public.comments for delete to authenticated
  using (author_id = (select auth.uid())
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

-- Stories (expired stories disappear for everyone but the owner)
create policy "view live permitted stories" on public.stories for select to authenticated
  using (user_id = (select auth.uid())
         or (expires_at > now() and public.can_view_profile((select auth.uid()), user_id)));
create policy "owner manages stories" on public.stories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Messaging. Conversations are created by a SECURITY DEFINER RPC (to add
-- both members atomically after checking match / allow_messages_from), so
-- there is deliberately no client INSERT policy on conversations/members.
create policy "members view conversation" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, (select auth.uid())));
create policy "members view membership" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "update own membership prefs" on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read messages" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "members send when not blocked" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid())
              and public.is_conversation_member(conversation_id, sender_id)
              and public.conversation_unblocked(conversation_id, sender_id));

-- Private albums: owners manage grants; requesters can create a request and see its status.
create policy "see own grants" on public.private_album_grants for select to authenticated
  using ((select auth.uid()) in (owner_id, viewer_id));
create policy "request access" on public.private_album_grants for insert to authenticated
  with check (viewer_id = (select auth.uid()) and status = 'requested'
              and not public.is_blocked(owner_id, viewer_id));
create policy "owner decides" on public.private_album_grants for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Reports: write-only for members. Moderators read via service role.
create policy "file reports" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

-- Notifications: written by triggers/server only; users read and mark their own.
create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage — all buckets private; paths are `{owner_uid}/{uuid}.{ext}`.
--   media          avatars, gallery, post & story images
--   private-media  private album photos
--   message-media  photos sent in conversations: `{conversation_id}/{uuid}.{ext}`
-- Uploads should go through a server route that validates type/size, strips
-- EXIF/GPS metadata, and runs content moderation before the object is referenced.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('private-media', 'private-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('message-media', 'message-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('media', 'private-media')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own objects" on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'private-media')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "read media of viewable profiles" on storage.objects for select to authenticated
  using (bucket_id = 'media'
         and public.can_view_profile((select auth.uid()), ((storage.foldername(name))[1])::uuid));

create policy "read private media with access" on storage.objects for select to authenticated
  using (bucket_id = 'private-media'
         and public.has_album_access((select auth.uid()), ((storage.foldername(name))[1])::uuid));

create policy "conversation members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-media'
              and public.is_conversation_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
              and public.conversation_unblocked(((storage.foldername(name))[1])::uuid, (select auth.uid())));
create policy "conversation members read" on storage.objects for select to authenticated
  using (bucket_id = 'message-media'
         and public.is_conversation_member(((storage.foldername(name))[1])::uuid, (select auth.uid())));
