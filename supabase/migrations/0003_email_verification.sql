-- =============================================================================
-- 0003 — email one-time codes as a verification method.
-- STATUS: DRAFT, like 0001/0002. Apply after them.
--
-- Accounts verified with an email code have no phone, so creating and finishing a profile
-- now needs a confirmed email address OR a confirmed phone number (read from auth.users,
-- never from the client). Non-destructive: two functions are replaced in place with the
-- same signatures; has_verified_phone() stays for compatibility. No data changes.
-- =============================================================================

create function public.has_verified_contact(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = uid and (email_confirmed_at is not null or phone_confirmed_at is not null)
  );
$$;
revoke execute on function public.has_verified_contact(uuid) from public, anon, authenticated;

-- Same as 0002 apart from the verification check.
create or replace function public.save_account(p_username text, p_terms_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.has_verified_contact(uid) then
    raise exception 'Verify your email or phone first' using errcode = 'insufficient_privilege';
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

create or replace function public.complete_onboarding() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  done timestamptz;
begin
  if uid is null or not public.has_verified_contact(uid) or not exists (
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

comment on function public.has_verified_phone(uuid) is 'Superseded by has_verified_contact() in 0003; kept for compatibility.';
