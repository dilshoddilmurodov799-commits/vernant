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
- Phone verification: sign-up creates the email account, then adds the phone with
  `updateUser({ phone })`, which texts a code. The account is locked (proxy redirect +
  `requireUser()`) until `verifyOtp({ type: "phone_change" })` succeeds. The JWT `phone` claim is
  only populated after verification in this flow, so it's used as the "verified" flag; **phone
  sign-ups must stay disabled** in the dashboard or that assumption breaks. The code is checked
  against the pending number read from the Auth server (`getUser().new_phone`), never from the form.
  Phone numbers are private: shown only to their owner, never to other members, never logged.
- Phone input is a country picker + national number; the server action joins them into E.164
  (`toInternational()`: drops the trunk prefix such as a leading 0; a number typed with `+` wins).
- Sign-up asks for a username only (no display name) and stores it in `user_metadata`. Metadata is client-writable via
  the Auth API, so the `auth.users` insert trigger (`handle_new_user`) that creates the
  `profiles` row relies on that table's constraints (format, unique username), not on the
  metadata. The server action also pre-checks the username so a taken one gets a field error.
- Log-in accepts an email or a username. A username is resolved to the account email on the
  server through `login_email()`, a `SECURITY DEFINER` RPC executable only by the service role
  (`src/lib/supabase/admin.ts`); the email is passed straight to `signInWithPassword` and never
  returned to the browser (not even in the "confirm your email" hint). Unknown usernames get the
  same error as a wrong password. Without the service-role key or the migration, username log-in
  answers "use your email" and sign-up skips the pre-check.

## Guest browsing
- Signed-out visitors can browse `/feed`, `/discover`, `/profile/<username>` (not `/profile/me`)
  and `/stories/<id>` (`isBrowsePath()` in `src/lib/auth/paths.ts`). Everything else fails closed.
  Signed-in accounts still need a verified phone on these pages.
- `isMember()` (signed in + verified phone) is passed un-awaited to `ViewerProvider`, so the shell
  prerenders and the session streams in. `MemberGate` / `useMemberAction()` show guests a join
  prompt instead of liking, following, commenting, reporting, blocking, or replying. That is UX only.
- When real data lands, the "no table readable by `anon`" rule stays: guest pages will read through
  server code that returns only content whose owner chose `visibility = 'everyone'` (and public
  posts/stories), never private fields. Members-only and matches-only content stays behind RLS.

## Data access
- Browser and server components use the **publishable key + user session** only. All authorization
  happens in Postgres **Row Level Security** (`supabase/migrations/0001_initial_schema.sql`).
- `SUPABASE_SERVICE_ROLE_KEY` stays server-only and is used only for the username → email
  log-in lookup, moderation, and admin jobs.
  It must never get a `NEXT_PUBLIC_` prefix or be imported from a client component.
- Trust-sensitive mutations (creating conversations, match detection, verification, account
  deletion) run as `SECURITY DEFINER` RPCs or server actions. Clients don't write those
  tables directly.

## Age & identity
- Members are expected to be adults, but sign-up has **no age gate** and doesn't ask for a birth
  date (product decision). If a birth date is added later it must be 18+ (DB trigger on
  `profile_private.birth_date`), and the "Appears under 18" report reason is prioritized in moderation.
- Birth date (optional) lives in an owner-only table. Other members only ever see the derived age.
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
