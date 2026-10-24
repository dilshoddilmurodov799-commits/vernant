-- Email-verified accounts (migration 0003): profile creation needs a confirmed email or phone,
-- retries never duplicate a profile, and usernames stay unique. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fictional fixtures:
--   f frank: email confirmed (code verified), no phone      g gina: email not confirmed, no phone
--   h hana:  email confirmed                                p pat:  phone confirmed, no email
insert into auth.users (id, email, email_confirmed_at, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000f1', 'frank@example.test', now(), null, null),
  ('00000000-0000-4000-8000-0000000000f2', 'gina@example.test', null, null, null),
  ('00000000-0000-4000-8000-0000000000f3', 'hana@example.test', now(), null, null),
  ('00000000-0000-4000-8000-0000000000f4', null, null, '15555550196', now());

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}';
select throws_ok($$select public.save_account('t_gina', 'v1')$$, '42501', null, 'an unconfirmed email cannot create a profile');
select throws_ok($$select public.complete_onboarding()$$, '55000', null, 'an unconfirmed email cannot finish onboarding');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select lives_ok($$select public.save_account('t_frank', 'v1')$$, 'a confirmed email (no phone) can create a profile');
select lives_ok($$select public.save_account('t_frank', 'v1')$$, 'repeating the account step is safe');
select lives_ok($$select public.save_account('t_frank2', 'v1')$$, 'going back and changing the username is safe');
select is((select count(*)::int from public.profiles where id = auth.uid()), 1, 'repeated submissions keep exactly one profile');
select is((select username::text from public.profiles where id = auth.uid()), 't_frank2', 'the latest username wins');
select is((select count(*)::int from public.profile_private where user_id = auth.uid()), 1, 'and exactly one private row');
select lives_ok($$select public.complete_onboarding()$$, 'a confirmed email can finish onboarding');
select ok((select onboarded_at is not null from public.profiles where id = auth.uid()), 'onboarding is recorded');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}';
select throws_ok($$select public.save_account('T_FRANK2', 'v1')$$, '23505', null, 'another account cannot take the same username');
select is((select count(*)::int from public.profiles where id = auth.uid()), 0, 'a failed claim creates nothing');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f4","role":"authenticated"}';
select lives_ok($$select public.save_account('t_pat', 'v1')$$, 'a confirmed phone still works');

select throws_ok($$select public.has_verified_contact(auth.uid())$$, '42501', null, 'members cannot probe verification status directly');

select * from finish();
rollback;
