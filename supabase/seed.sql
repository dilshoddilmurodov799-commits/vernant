-- LOCAL DEVELOPMENT ONLY. Fictional members for exercising policies with `supabase db reset`.
-- Never run this against a hosted or production project. The accounts have no password and
-- use +1 555-01xx numbers, which are reserved for fiction, so nobody can sign in as them.
insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('5eed0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '15555550101', now(), '{"provider":"phone","providers":["phone"]}', '{}'),
  ('5eed0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '15555550102', now(), '{"provider":"phone","providers":["phone"]}', '{}'),
  ('5eed0000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '15555550103', now(), '{"provider":"phone","providers":["phone"]}', '{}');

insert into public.profiles (id, username, bio, city, identities, looking_for, interests, visibility, onboarding_step, onboarded_at) values
  ('5eed0000-0000-4000-8000-000000000001', 'marcus.hale', 'Weekend baker. Ask me about sourdough.', 'Portland',
   '{Bear}', '{Dating,Friends}', '{Baking,Hiking}', 'everyone', 3, now()),
  ('5eed0000-0000-4000-8000-000000000002', 'theo.banks', 'Cyclist, jazz nerd, bad at karaoke.', 'Chicago',
   '{Chub}', '{Relationship}', '{Cycling,Jazz}', 'everyone', 3, now()),
  ('5eed0000-0000-4000-8000-000000000003', 'sam.rivers', 'Woodworker with a very loud dog.', 'Denver',
   '{Otter}', '{Community,Chat}', '{Woodworking,Dogs}', 'members', 3, now());

insert into public.profile_private (user_id, terms_accepted_at, terms_version)
select id, now(), 'seed' from public.profiles where id::text like '5eed%';

insert into public.user_preferences (user_id) select id from public.profiles where id::text like '5eed%';

insert into public.follows (follower_id, followee_id) values
  ('5eed0000-0000-4000-8000-000000000003', '5eed0000-0000-4000-8000-000000000001');

-- A mutual like: the sync_match trigger turns it into a match.
insert into public.profile_likes (liker_id, likee_id) values
  ('5eed0000-0000-4000-8000-000000000001', '5eed0000-0000-4000-8000-000000000002'),
  ('5eed0000-0000-4000-8000-000000000002', '5eed0000-0000-4000-8000-000000000001');

insert into public.posts (author_id, caption) values
  ('5eed0000-0000-4000-8000-000000000001', 'First loaf of the season.'),
  ('5eed0000-0000-4000-8000-000000000002', 'Lakefront ride this morning.');
