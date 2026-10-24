# Permission test matrix

What each kind of user may and may not do, as enforced by Postgres (RLS policies, `SECURITY
DEFINER` functions and triggers in `supabase/migrations/0001`–`0003`). Every row is an assertion
in `supabase/tests/database/rls.test.sql` or `email_verification.test.sql`; run them with
`npx supabase test db`.

Users in the tests: **anon** (no session), **erin** (signed in, phone not verified), **dave**
(account step done, onboarding unfinished), **alice / bob / carol** (onboarded, profiles set to
`everyone`). In `email_verification.test.sql`: **frank / hana** (email confirmed, no phone),
**gina** (email not confirmed), **pat** (phone confirmed, no email).

| Area | Allowed | Denied (expected error or empty result) |
| --- | --- | --- |
| Anonymous | — | reading profiles or posts (empty); `save_account`, `username_available` (42501) |
| Account setup | verified phone claims a username; retrying is a no-op (one row); completing twice is a no-op | no verified phone → `save_account` 42501; completing without an account → 55000; taken username in any case → 23505; malformed username or missing consent → 23514 |
| Email-verified accounts | a confirmed email (no phone) or a confirmed phone creates and finishes a profile; repeating or changing the username keeps exactly one profile and one private row | unconfirmed email → `save_account` 42501, `complete_onboarding` 55000; another account taking the same username in any case → 23505 and nothing created; calling `has_verified_contact` as a member (42501) |
| Profile ownership | owner edits bio, visibility | inserting profile rows directly, even for another id (42501); self-setting `onboarded_at`, `verified`, `avatar_path` (42501); editing someone else's profile (0 rows changed) |
| Unfinished onboarding | resuming their own steps | seeing other profiles or posts (empty); following, posting, starting conversations (42501); being seen by others (empty) |
| Posts & comments | reading public posts of visible members; commenting on them | posting as someone else (42501); blocked members' posts (empty) |
| Matches | mutual like creates exactly one match (trigger) | inserting a match directly (42501); one-sided like is not a match; third parties seeing matches or likes (empty); liking for someone else (42501) |
| Messaging | matched members start a conversation (same one on retry) and send messages | creating conversations directly (42501); non-members reading messages or members (empty) or posting into a conversation (42501); messaging someone who limits messages to their network (42501) |
| Blocking | blocker manages their own blocks | both sides seeing each other's profile or posts (empty); the blocked member seeing the block (empty); messaging or liking across a block (42501); the match survives a block (deleted) |
| Media & stories | owner sees their own pending photos | others seeing pending photos (rows or files, empty); clients uploading to media buckets or attaching photo rows (42501); owner self-approving a story (42501); others seeing unmoderated stories (empty) |
| Private data | owner reads/updates own preferences and private row | reading others' `profile_private` or `user_preferences` (empty); writing others' preferences (42501) |
| Reports | filing a report | reading any report, including your own (empty) |
| Notifications | — | reading others' notifications (empty); creating notifications (42501) |
| Log-in lookup | secret key (server) only | `login_identity` as a member (42501) |

Error codes: `42501` insufficient privilege / RLS violation, `23505` unique violation,
`23514` check violation, `55000` prerequisite missing.

Both suites were also run against the migrations on PGlite (Postgres 18 in WASM), with stand-in
`auth`/`storage` schemas and a pgTAP subset: 88/88 pass. Weakening three policies (open message
reads, client match inserts, `can_view_profile` → true) makes 13 of them fail. Without 0003, 10
of the 14 email checks fail.
