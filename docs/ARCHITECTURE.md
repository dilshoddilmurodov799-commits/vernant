# Architecture & security plan

Status: **Auth is live** (Supabase Auth with one-time email codes; SMS/WhatsApp codes behind
flags). Onboarding writes to Postgres once migrations `0001`–`0003` are applied (all still
drafts). Other in-app screens still run on demo data.

## Authentication
- `@supabase/ssr` with cookie sessions. `src/proxy.ts` (Next 16's renamed middleware) creates a
  per-request server client, calls `auth.getClaims()` to validate and refresh the JWT, and writes
  refreshed cookies plus no-store cache headers to the response.
- The proxy's redirects are UX only. Protected trees re-check on the server (`RequireUser` →
  `requireUser()`: session → verified phone → finished onboarding), and server actions check
  again before acting. Never trust `getSession()` on the server.
- Route rules (`src/lib/auth/paths.ts`) fail closed: any path not listed as public needs a session.
  `next` redirect targets are restricted to same-origin paths, and never to `/onboarding` itself
  once it's finished (`afterOnboardingPath()`).
- All auth input is validated with Zod in server actions. Responses never reveal whether an email
  or phone number has an account.
- **Sign-up and code log-in use one-time codes** (`src/lib/auth/otp.ts`): `signInWithOtp({ email,
  options: { shouldCreateUser: true } })`, then `verifyOtp({ email, token, type: "email" })`, which
  starts the session. The same flow logs existing accounts in, so it never discloses registration.
  Supabase generates, sends and checks the codes. The app never stores or logs them and only
  reports "sent" when Supabase accepted the request. The address lives in React state between
  the two steps (no storage, no URL).
- SMS and WhatsApp use the same flow (`{ phone, options: { channel } }`, verify type `sms`) but
  are offered **and accepted by the server** only when `AUTH_SMS_ENABLED` / `AUTH_WHATSAPP_ENABLED`
  is `true`. That flag is set by hand once the provider is configured and tested, so the UI never
  offers a channel that can't deliver. `/verify-phone` (adding a number) follows the SMS flag.
- Rate limits: Supabase's own (one code per address per 60 s, hourly send caps, per-IP buckets),
  plus in-memory per-instance limits in `otp.ts` (5 sends per address and 20 per IP per 15 min,
  10 code attempts per address). The in-memory limits don't share state across instances, so
  move them to a shared store (e.g. Redis) for multi-instance hosting. Because the calls come
  from server actions, Supabase sees the server's IP: enable its IP forwarding (`Sb-Forwarded-For`)
  before real traffic.
- "Verified" means a confirmed email **or** phone: the JWT carries `email` / `phone` only for
  confirmed contacts while Supabase requires confirmation (Confirm email on, phone confirmations
  on). The database checks `auth.users.email_confirmed_at` / `phone_confirmed_at` itself
  (`has_verified_contact()`, migration 0003) before creating or finishing a profile.
- Phone input is a country picker + national number; the server joins them into E.164
  (`toInternational()`). Numbers are private: shown masked to their owner (`maskPhone()`), never
  to other members, never logged.
- Log-in: password with an email or a username, or a one-time code. A username is resolved
  server-side by `login_identity()`, a `SECURITY DEFINER` RPC executable only with the secret key
  (`src/lib/supabase/admin.ts`). It returns the email, or the phone for phone-only accounts,
  which goes straight to `signInWithPassword` and is never returned to the browser. Unknown
  usernames get the same error as a wrong password.

## Onboarding
- Five steps in the indicator: email (or phone) and code on `/register`, then account, profile and
  preferences on `/onboarding` (`src/lib/onboarding/`). Each screen saves before moving on;
  `profiles.onboarding_step` records progress so a refresh or a new device resumes at the right step.
- Account step: `save_account(username, terms_version)` (`SECURITY DEFINER`, `search_path = ''`)
  requires `auth.uid()` with a confirmed email or phone, upserts the caller's own profile row, and records
  consent in `profile_private`. It is keyed on `auth.uid()`, so retries can't duplicate anything,
  and the citext unique constraint resolves username races. Clients have no INSERT policy on
  `profiles`. Phone-only accounts must set a password here (`updateUser`) so username log-in
  works; for email accounts it's optional, since they can always use an email code. Either way
  it's Supabase's own password, not a second auth system. No age question: members are expected
  to be adults (product decision), and a self-declaration isn't verification anyway.
- `complete_onboarding()` sets `profiles.onboarded_at`. A trigger stops members from setting
  `onboarded_at`, `verified` or `avatar_path` themselves.
- Gate: `requireUser()` sends unfinished accounts to `/onboarding`, including when the status
  can't be read (fail closed). `ResumeOnboarding` does the same on guest-browsable layouts, and
  `isMember()` is false until onboarding is finished. In SQL, `can_view_profile()` requires both
  sides to be onboarded, and post, story and message writes require `is_onboarded()`, so a
  half-made account can't see or write social data even through the API.
- The profile and preference screens are optional ("Skip for now"). Discovery preferences live in
  owner-only `user_preferences`. No location is requested; distance needs a later, explicitly
  consented approximate location.

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
  happens in Postgres **Row Level Security** (`supabase/migrations/0001`, `0002`), covered by pgTAP
  tests in `supabase/tests/database/` (matrix: `docs/PERMISSIONS.md`).
- The secret key (`SUPABASE_SECRET_KEY`, or the legacy `SUPABASE_SERVICE_ROLE_KEY`) stays
  server-only (`import "server-only"`). It is used only for the username log-in lookup, processed
  photo uploads, moderation, and admin jobs. It must never get a `NEXT_PUBLIC_` prefix, be imported
  from a client component, or be committed (`.env.local` only).
- Trust-sensitive writes run as `SECURITY DEFINER` RPCs or server code, and clients have no
  policy to write those tables directly. That covers matches (`sync_match` trigger on mutual
  likes, serialized with an advisory lock), conversations (`start_conversation()`, which checks
  the match / `allow_messages_from` / block), onboarding (`save_account`, `complete_onboarding`),
  verification, media rows, and account deletion.

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
  profiles, posts, stories, likes, or media, or send messages. A block also deletes likes (and so
  the match), follows and album grants in both directions.
- Location is stored coarsely (about 1 km) and shown as an approximate distance only.

## Media
- All buckets are **private**. Clients receive short-lived signed URLs.
- Paths are `{owner_uid}/…` (or `{conversation_id}/…` for message media). Storage policies
  check ownership, profile visibility, album grants, and conversation membership.
- Uploads go through the server only (clients have no INSERT policy on media buckets). The profile
  photo action (`uploadPhoto`) checks the size and type, decodes the image with sharp to
  verify the real format, guards against decompression bombs, applies EXIF orientation and
  re-encodes to WebP. Re-encoding drops all metadata, including GPS. It then stores the result at
  `media/{uid}/{uuid}.webp` and records it `pending`.
- Moderation: `pending` and `rejected` media is visible to its owner only, both as rows
  (`profile_photos`, `post_media`, `stories.status`) and as files (`can_read_media()` in the
  storage read policy). **No automated scanner is connected yet**, so approval is a manual or
  moderator job using the secret key. Connect a scanner before launch.
- Private albums need an approved `private_album_grants` row (or a match, if the owner allows
  that). The owner can revoke access at any time. Incoming chat photos are blurred by default.

## Before real data
1. Apply the migrations to a local or development project and run `supabase test db` (README).
2. Configure custom SMTP (the built-in sender only reaches team addresses). Connect CAPTCHA
   (Turnstile or hCaptcha) to the code request and log-in forms. Enable Supabase IP forwarding,
   and move the app-side rate limits to a shared store.
3. Connect an automated media moderation scanner, and build the moderator queue (approve or
   reject `pending` media, read reports).
4. Publish the Community Guidelines, Terms of Service and Privacy Policy, link them from the
   consent text, and bump `TERMS_VERSION`.
5. Replace `src/lib/demo/store.tsx` actions with typed queries and mutations one screen at a time.
6. Add rate limiting (likes, messages, reports).
