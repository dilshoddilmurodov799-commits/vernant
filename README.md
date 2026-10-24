# Vernant — 18+ dating & community prototype

A premium, dark-first social and dating app for bears, chubs, cubs, and their admirers.
**Accounts are real** (Supabase Auth: sign-up, email confirmation, sign-in, password reset,
sign-out). **Everything inside the app is still a prototype** running on clearly labeled,
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
and every signed-in route redirects to `/login` (fail closed).

## Supabase Auth setup (dashboard)

1. **Project Settings → API Keys**: copy the project URL and the **publishable** key into
   `.env.local`. Never put the secret/service-role key in a `NEXT_PUBLIC_` variable.
2. **Authentication → Sign In / Providers → Email**: enable the Email provider and keep
   **Confirm email** on. Set minimum password length to **10** (matches the app's check).
   Optionally enable leaked-password protection.
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` locally, your production origin in production.
   - Redirect URLs: add `http://localhost:3000/auth/confirm` and
     `https://<your-domain>/auth/confirm` (plus preview URLs if you use them).
4. **Authentication → Email Templates** (recommended — links then work across devices/browsers):
   - *Confirm signup*: link to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - *Reset password*: link to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   With the default `{{ .ConfirmationURL }}` templates, links still work through the PKCE
   `code` exchange, but only in the browser where the request was made.
5. **Authentication → Emails → SMTP**: the built-in sender is heavily rate-limited and for
   testing only; configure custom SMTP before inviting real users.

## Auth flow

| Path | Purpose |
| --- | --- |
| `src/proxy.ts` → `lib/supabase/proxy.ts` | Refreshes the session cookie on every request (`getClaims()`), redirects signed-out visitors to `/login?next=…` and signed-in visitors away from `/login`, `/register`, `/forgot-password`. |
| `lib/auth/actions.ts` | Server actions: sign up, sign in, resend confirmation, request reset, update password, sign out. Zod-validated (`lib/auth/schemas.ts`). |
| `app/auth/confirm` | Verifies email links (`token_hash` or PKCE `code`) and signs the user in. |
| `app/auth/error` | Expired/invalid link page. |
| `components/auth/require-user.tsx` | Server-side session check wrapping `(app)`, `onboarding`, `stories`, and `/reset-password`. |

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
    (app)/                   Signed-in shell (sidebar / mobile tab bar)
      feed/ discover/ matches/ notifications/ settings/
      profile/[username]/    "me" or a username
      messages/ + messages/[conversationId]/ Two-pane on desktop, full-screen chat on mobile
    stories/[id]/            Full-screen story viewer
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
