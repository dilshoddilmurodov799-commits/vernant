# Architecture & security plan

Status: **Auth is live** (Supabase Auth). Everything else below is planned; in-app screens still
run on demo data.

## Authentication
- `@supabase/ssr` with cookie sessions. `src/proxy.ts` (Next 16's renamed middleware) creates a
  per-request server client, calls `auth.getClaims()` to validate and refresh the JWT, and writes
  refreshed cookies plus no-store cache headers to the response.
- The proxy's redirects are UX only. Protected trees re-check the session on the server
  (`RequireUser` → `requireUser()` → `getClaims()`), and server actions check again before acting.
  Never trust `getSession()` on the server.
- Route rules (`src/lib/auth/paths.ts`) fail closed: any path not listed as public needs a session.
  `next` redirect targets are restricted to same-origin paths.
- All auth input is validated with Zod in server actions. Errors never reveal whether an email has
  an account (sign-up, resend, and reset all respond the same way).
- Sign-up stores `display_name` and `birth_date` in `user_metadata` (visible only to the user and
  the service role). Metadata is user-editable, so when the profile migration lands, the
  `auth.users` insert trigger that copies `birth_date` into `profile_private` must rely on that
  table's 18+ trigger, not on the metadata.

## Data access
- Browser and server components use the **publishable key + user session** only. All authorization
  happens in Postgres **Row Level Security** (`supabase/migrations/0001_initial_schema.sql`).
- `SUPABASE_SERVICE_ROLE_KEY` stays server-only and is used only for moderation and admin jobs.
  It must never get a `NEXT_PUBLIC_` prefix or be imported from a client component.
- Trust-sensitive mutations (creating conversations, match detection, verification, account
  deletion) run as `SECURITY DEFINER` RPCs or server actions. Clients don't write those
  tables directly.

## Age & identity
- 18+ is enforced in four places: the sign-up date picker, Zod in the sign-up server action, a DB trigger on `profile_private.birth_date`,
  and moderation (the "Appears under 18" report reason is prioritized).
- Birth date lives in an owner-only table. Other members only ever see the derived age.
- `profiles.verified` can only be changed by moderation (a trigger blocks client updates).

## Privacy & blocking
- Profile visibility: `everyone` / `members` (follow graph) / `matches`. This is enforced by
  `can_view_profile()` and reused by the post, story, follow, like, and storage policies.
- Blocking is symmetric and checked in SQL (`is_blocked()`), so blocked users can't see
  profiles, posts, stories, likes, or media, or send messages.
- Location is stored coarsely (about 1 km) and shown as an approximate distance only.

## Media
- All buckets are **private**. Clients receive short-lived signed URLs.
- Paths are `{owner_uid}/…` (or `{conversation_id}/…` for message media). Storage policies
  check ownership, profile visibility, album grants, and conversation membership.
- Uploads go through a server route: MIME/size validation, EXIF/GPS stripping,
  and an automated moderation scan before the object is referenced.
- Private albums need an approved `private_album_grants` row (or a match, if the owner allows
  that). The owner can revoke access at any time. Incoming chat photos are blurred by default.

## Before real data
1. Apply the migration to a local Supabase (`supabase start && supabase db reset`).
2. Write RLS tests (pgTAP) for every policy, especially block and visibility edge cases.
3. Replace `src/lib/demo/store.tsx` actions with typed queries and mutations one screen at a time.
4. Add rate limiting (likes, messages, reports) and an abuse/moderation queue.
