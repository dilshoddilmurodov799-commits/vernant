# Vernant — adult dating & community prototype

A premium, dark-first social and dating app for bears, chubs, cubs, and their admirers.
**Accounts are real** (Supabase Auth: sign-up with SMS phone verification, sign-in, password
reset, sign-out). **Everything inside the app is still a prototype** running on clearly labeled,
fictional demo data held in memory — profiles, posts, likes, and messages are not persisted.

## Run

```bash
npm install
cp .env.example .env.local   # then add your Supabase URL + publishable key
npm run dev        # http://localhost:3000
npm run lint
npx tsc --noEmit
npm test           # auth schema + redirect/route-rule unit tests (node:test)
npm run build
```

Without Supabase env vars the public pages render, sign-in forms show a configuration error,
and every member-only route redirects to `/login` (fail closed). Feed, Discover, profiles and
stories stay browsable.

## Supabase Auth setup (dashboard)

1. **Project Settings → API Keys**: copy the project URL and the **publishable** key into
   `.env.local`. Never put the secret/service-role key in a `NEXT_PUBLIC_` variable.
   Optionally set `SUPABASE_SERVICE_ROLE_KEY` (server-only) to enable logging in with a
   username; it also needs the `login_email()` function from `supabase/migrations/0001`.
2. **Authentication → Sign In / Providers → Email**: enable the Email provider and turn
   **Confirm email off** — the SMS code is the confirmation step. Set minimum password length
   to **10** (matches the app's check). Optionally enable leaked-password protection.
   (If Confirm email stays on, sign-up still works: users click the email link first, then
   verify their phone.)
3. **Authentication → Sign In / Providers → Phone**: enable the Phone provider and connect an
   SMS provider (Twilio, Twilio Verify, MessageBird, Vonage, or Textlocal — paid per message).
   Keep **Enable phone signup off**: numbers are added to email accounts with
   `updateUser({ phone })`, and the app treats the `phone` JWT claim as "verified" only because
   of that. Default OTP length (6) and expiry are fine. Check **Rate Limits → SMS** too.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` locally, your production origin in production.
   - Redirect URLs: add `http://localhost:3000/auth/confirm` and
     `https://<your-domain>/auth/confirm` (plus preview URLs if you use them).
5. **Authentication → Email Templates** (recommended — links then work across devices/browsers):
   - *Confirm signup*: link to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - *Reset password*: link to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   With the default `{{ .ConfirmationURL }}` templates, links still work through the PKCE
   `code` exchange, but only in the browser where the request was made.
6. **Authentication → Emails → SMTP**: the built-in sender is heavily rate-limited and for
   testing only; configure custom SMTP before inviting real users.

## Auth flow

| Path | Purpose |
| --- | --- |
| `src/proxy.ts` → `lib/supabase/proxy.ts` | Refreshes the session cookie on every request (`getClaims()`), lets signed-out visitors browse `/feed`, `/discover`, `/profile/<username>` and `/stories/<id>` (rules in `lib/auth/paths.ts`), redirects them to `/login?next=…` everywhere else, and redirects signed-in visitors away from `/login`, `/register`, `/forgot-password`. |
| `lib/auth/actions.ts` | Server actions: sign up (display name, username, email, phone with country code), sign in (email or username), resend confirmation, request reset, update password, sign out. Zod-validated (`lib/auth/schemas.ts`). |
| `app/(auth)/verify-phone` | After sign-up: texts a 6-digit code (`updateUser({ phone })`) and verifies it (`verifyOtp`, type `phone_change`). Every signed-in page except this and `/reset-password` stays locked until the phone is verified. |
| `app/auth/confirm` | Verifies email links (`token_hash` or PKCE `code`) and signs the user in. |
| `app/auth/error` | Expired/invalid link page. |
| `components/auth/require-user.tsx` | Server-side session check wrapping `(app)/(member)` (matches, messages, notifications, settings, design), `/profile/me`, `onboarding`, and `/reset-password`. |
| `components/auth/member-gate.tsx` | Guest vs. member on browse pages: the shell shows Log in / Join to guests, and `useMemberAction()` turns like, follow, comment, report, and reply into a join prompt. UI only; real writes must be authorized server-side. |

Route rules live in `lib/auth/paths.ts`: anything not explicitly public requires a session.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Lucide · Radix (`radix-ui`) · Supabase Auth via `@supabase/ssr` · Zod.

## Structure

```
src/
  app/
    page.tsx                 Landing
    (auth)/login, register   Auth screens (demo validation only)
    onboarding/              5-step profile setup
    (app)/                   App shell (sidebar / mobile tab bar); guests can browse
      feed/ discover/        Open to guests
      profile/[username]/    Open to guests; "me" needs an account
      (member)/              Account required: matches/ notifications/ settings/ design/
        messages/ + messages/[conversationId]/ Two-pane on desktop, full-screen chat on mobile
    stories/[id]/            Full-screen story viewer (open to guests)
  components/
    ui/                      Design system: Button, Avatar, Photo, Field, Dialog, DropdownMenu,
                             Badge/Chip/Segmented/Switch, Empty/Error/Skeleton, Toast, ThemeToggle
    layout/ feed/ stories/ discover/ profile/ matches/ chat/ notifications/ settings/
    safety/                  Report + block dialogs
    auth/                    Auth form, onboarding flow
  lib/
    types.ts                 Domain types (mirror the planned schema)
    demo/                    DEMO ONLY: data.ts, in-memory store, simulated latency
    supabase/                Browser/server clients + proxy session refresh (publishable key only)
    auth/                    Server actions, Zod schemas, route rules, session helpers
supabase/migrations/         DRAFT schema + RLS + storage policies (not applied)
docs/ARCHITECTURE.md         Security & data-access plan
```

## Design system

- Semantic color tokens with coordinated **dark (default) and light themes** in `src/app/globals.css`.
- Theme toggle in the sidebar, the mobile header, and Settings → Appearance (Light / Dark / System).
  The choice persists in `localStorage`, is applied before first paint (no flash), syncs across tabs,
  and follows live OS changes in System mode.
- Living reference of every token and component at **`/design`**.

## Demo notes

- Every person, post, and message is fictional. Images are hand-picked placeholder photos from
  picsum.photos (`src/lib/demo/images.ts`), with gradient fallbacks when offline.
- Interactions (like, follow, match, message, comment, post, block, report, settings) update
  in-memory state only. A full reload resets the data, and so does Settings → Reset demo data.
- The first visit to each main screen simulates ~0.5s of latency to show the skeleton states.
