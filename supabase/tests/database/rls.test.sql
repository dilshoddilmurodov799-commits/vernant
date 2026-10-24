-- Permission tests for migrations 0001 + 0002: authorized and unauthorized cases for
-- onboarding, profiles, matches, messaging, blocking, media, and private data.
-- Run with `supabase test db` (local stack). Everything runs in one rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

-- Fictional fixtures. phone_confirmed_at marks a verified number.
--   a alice, b bob, c carol: finish onboarding    d dave: stops after the account step
--   e erin: phone never verified
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-00000000000a', '15555550191', now()),
  ('00000000-0000-4000-8000-00000000000b', '15555550192', now()),
  ('00000000-0000-4000-8000-00000000000c', '15555550193', now()),
  ('00000000-0000-4000-8000-00000000000d', '15555550194', now()),
  ('00000000-0000-4000-8000-00000000000e', '15555550195', null);

-- ---------------------------------------------------------------- anonymous
set local role anon;
select is_empty($$select 1 from public.profiles$$, 'anon reads no profiles');
select is_empty($$select 1 from public.posts$$, 'anon reads no posts');
select throws_ok($$select public.save_account('t_anon', 'v1')$$, '42501', null, 'anon cannot create an account');
select throws_ok($$select public.username_available('t_anon')$$, '42501', null, 'anon cannot probe usernames');

-- ---------------------------------------------------------------- account setup
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok($$select public.save_account('t_erin', 'v1')$$, '42501', null, 'account setup requires a verified phone');
select throws_ok($$select public.complete_onboarding()$$, '55000', null, 'onboarding cannot complete without an account');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok($$select public.save_account('t_alice', 'v1')$$, 'a verified phone can claim a username');
select lives_ok($$select public.save_account('t_alice', 'v1')$$, 'retrying account setup is safe');
select is((select count(*)::int from public.profiles where id = auth.uid()), 1, 'retries never duplicate the profile');
select is((select onboarding_step::int from public.profiles where id = auth.uid()), 1, 'account step is recorded');
select throws_ok($$insert into public.profiles (id, username) values ('00000000-0000-4000-8000-00000000000d', 't_fake')$$,
  '42501', null, 'members cannot insert profile rows, even for another id');
select throws_ok($$update public.profiles set onboarded_at = now() where id = auth.uid()$$,
  '42501', null, 'onboarding completion cannot be forged');
select throws_ok($$update public.profiles set verified = true where id = auth.uid()$$,
  '42501', null, 'the verified badge cannot be self-granted');
select throws_ok($$update public.profiles set avatar_path = 'x/y.webp' where id = auth.uid()$$,
  '42501', null, 'avatars cannot point at unmoderated files');
select lives_ok($$select public.complete_onboarding()$$, 'onboarding completes after the account step');
select lives_ok($$select public.complete_onboarding()$$, 'completing again is a no-op');
select lives_ok($$update public.profiles set visibility = 'everyone', bio = 'hi' where id = auth.uid()$$,
  'owners edit their own profile');
select is((select count(*)::int from public.user_preferences where user_id = auth.uid()), 1, 'completion creates default preferences');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select throws_ok($$select public.save_account('T_Alice', 'v1')$$, '23505', null, 'usernames are unique regardless of case');
select throws_ok($$select public.save_account('no spaces', 'v1')$$, '23514', null, 'malformed usernames are rejected');
select throws_ok($$select public.save_account('t_bob', null)$$, '23514', null, 'terms consent is required');
select is(public.username_available('t_alice'), false, 'a taken username is unavailable');
select is(public.username_available('t_free'), true, 'a free username is available');
select lives_ok($$select public.save_account('t_bob', 'v1')$$, 'bob claims a username');
select is(public.username_available('t_bob'), true, 'your own username counts as available to you');
select lives_ok($$select public.complete_onboarding()$$, 'bob completes onboarding');
update public.profiles set visibility = 'everyone' where id = auth.uid();
insert into public.posts (author_id, caption) values (auth.uid(), 'bob post');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 1,
  'onboarded members see public profiles');
update public.profiles set bio = 'hacked' where id = '00000000-0000-4000-8000-00000000000a';
select is((select bio from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'hi',
  'members cannot edit other profiles');
select is_empty($$select 1 from public.profile_private where user_id <> auth.uid()$$, 'private account rows stay private');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';
select public.save_account('t_carol', 'v1');
select public.complete_onboarding();
update public.profiles set visibility = 'everyone' where id = auth.uid();
insert into public.posts (author_id, caption) values (auth.uid(), 'carol post');

-- ---------------------------------------------------------------- unfinished onboarding
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}';
select public.save_account('t_dave', 'v1');
update public.profiles set visibility = 'everyone' where id = auth.uid();
select is_empty($$select 1 from public.profiles where id <> auth.uid()$$, 'unfinished accounts cannot browse members');
select is_empty($$select 1 from public.posts$$, 'unfinished accounts cannot read posts');
select throws_ok($$insert into public.follows (follower_id, followee_id) values (auth.uid(), '00000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'unfinished accounts cannot follow');
select throws_ok($$insert into public.posts (author_id, caption) values (auth.uid(), 'early')$$,
  '42501', null, 'unfinished accounts cannot post');
select throws_ok($$select public.start_conversation('00000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'unfinished accounts cannot message');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is_empty($$select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000d'$$, 'unfinished profiles are hidden');

-- ---------------------------------------------------------------- posts
select is((select count(*)::int from public.posts where author_id = '00000000-0000-4000-8000-00000000000c'), 1,
  'public posts of visible members are readable');
select lives_ok($$insert into public.comments (post_id, author_id, body)
  select id, auth.uid(), 'nice' from public.posts where author_id = '00000000-0000-4000-8000-00000000000c'$$,
  'members comment on visible posts');
select throws_ok($$insert into public.posts (author_id, caption) values ('00000000-0000-4000-8000-00000000000c', 'impersonation')$$,
  '42501', null, 'members cannot post as someone else');

-- ---------------------------------------------------------------- matches
select throws_ok($$insert into public.matches (user_a, user_b)
  values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'matches cannot be forged');
insert into public.profile_likes (liker_id, likee_id) values (auth.uid(), '00000000-0000-4000-8000-00000000000b');
select is_empty($$select 1 from public.matches$$, 'a one-sided like is not a match');
select throws_ok($$insert into public.profile_likes (liker_id, likee_id)
  values ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'members cannot like on someone else''s behalf');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
insert into public.profile_likes (liker_id, likee_id) values (auth.uid(), '00000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.matches), 1, 'a mutual like creates the match');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';
select is_empty($$select 1 from public.matches$$, 'others cannot see a match');
select is_empty($$select 1 from public.profile_likes$$, 'others cannot see likes');

-- ---------------------------------------------------------------- messaging
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok($$select public.start_conversation('00000000-0000-4000-8000-00000000000b')$$, 'matched members can start a conversation');
select is(public.start_conversation('00000000-0000-4000-8000-00000000000b'),
          public.start_conversation('00000000-0000-4000-8000-00000000000b'), 'starting again returns the same conversation');
select throws_ok($$insert into public.conversations default values$$, '42501', null, 'conversations cannot be created directly');
select lives_ok($$insert into public.messages (conversation_id, sender_id, body)
  select conversation_id, auth.uid(), 'hello' from public.conversation_members where user_id = auth.uid()$$,
  'members send messages');

reset role;
select set_config('t.conv', (select conversation_id::text from public.conversation_members
                             where user_id = '00000000-0000-4000-8000-00000000000a' limit 1), true);
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';
select is_empty($$select 1 from public.messages$$, 'non-members cannot read messages');
select is_empty($$select 1 from public.conversation_members$$, 'non-members cannot see who is talking');
select throws_ok($$insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('t.conv')::uuid, auth.uid(), 'intrude')$$, '42501', null, 'non-members cannot post into a conversation');
select throws_ok($$select public.start_conversation('00000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'unconnected members cannot message someone who limits messages to members');

-- ---------------------------------------------------------------- blocking
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-4000-8000-00000000000a');
select is_empty($$select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000a'$$, 'blockers no longer see who they blocked');
select is_empty($$select 1 from public.matches$$, 'blocking ends the match');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is_empty($$select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000b'$$, 'blocked members cannot see the blocker');
select is_empty($$select 1 from public.posts where author_id = '00000000-0000-4000-8000-00000000000b'$$, 'blocked members cannot see the blocker''s posts');
select is_empty($$select 1 from public.blocks$$, 'blocked members cannot see the block itself');
select throws_ok($$insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('t.conv')::uuid, auth.uid(), 'still there?')$$, '42501', null, 'blocked members cannot message');
select throws_ok($$insert into public.profile_likes (liker_id, likee_id) values (auth.uid(), '00000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'blocked members cannot like');

-- ---------------------------------------------------------------- media and stories
reset role;
insert into storage.objects (bucket_id, name) values
  ('media', '00000000-0000-4000-8000-00000000000c/p1.webp'),
  ('media', '00000000-0000-4000-8000-00000000000c/p2.webp');
insert into public.profile_photos (user_id, storage_path, sort_order, status) values
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c/p1.webp', 0, 'pending'),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c/p2.webp', 1, 'approved');
set local role authenticated;

select is((select count(*)::int from public.profile_photos where user_id = '00000000-0000-4000-8000-00000000000c'), 1,
  'only approved photos are visible to others');
select is((select count(*)::int from storage.objects where name like '00000000-0000-4000-8000-00000000000c/%'), 1,
  'pending uploads cannot be listed or downloaded');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('media', auth.uid()::text || '/raw.jpg')$$,
  '42501', null, 'clients cannot upload unprocessed media');
select throws_ok($$insert into public.profile_photos (user_id, storage_path) values (auth.uid(), auth.uid()::text || '/raw.jpg')$$,
  '42501', null, 'clients cannot attach photos without the server');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';
select is((select count(*)::int from public.profile_photos), 2, 'owners see their own pending photos');
insert into public.stories (user_id, media_path) values (auth.uid(), '00000000-0000-4000-8000-00000000000c/s1.webp');
select throws_ok($$update public.stories set status = 'approved' where user_id = auth.uid()$$,
  '42501', null, 'owners cannot approve their own stories');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is_empty($$select 1 from public.stories$$, 'unmoderated stories stay hidden');

-- ---------------------------------------------------------------- private data
select lives_ok($$update public.user_preferences set age_min = 25, age_max = 40 where user_id = auth.uid()$$,
  'owners save their preferences');
select throws_ok($$insert into public.user_preferences (user_id) values ('00000000-0000-4000-8000-00000000000c')$$,
  '42501', null, 'members cannot write someone else''s preferences');
select is_empty($$select 1 from public.user_preferences where user_id <> auth.uid()$$, 'preferences are private');
select lives_ok($$insert into public.reports (reporter_id, target_user_id, reason)
  values (auth.uid(), '00000000-0000-4000-8000-00000000000c', 'spam')$$, 'members can file reports');
select is_empty($$select 1 from public.reports$$, 'reports are write-only for members');
select throws_ok($$select * from public.login_identity('t_bob')$$, '42501', null, 'members cannot look up login identities');

reset role;
insert into public.notifications (user_id, type) values ('00000000-0000-4000-8000-00000000000b', 'like');
set local role authenticated;
select is_empty($$select 1 from public.notifications$$, 'notifications are private to the recipient');
select throws_ok($$insert into public.notifications (user_id, type) values ('00000000-0000-4000-8000-00000000000b', 'fake')$$,
  '42501', null, 'members cannot forge notifications');

select * from finish();
rollback;
