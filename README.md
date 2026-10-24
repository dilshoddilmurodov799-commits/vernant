# Vernant — adult dating & community prototype

A premium, dark-first social and dating app for bears, chubs, cubs, and their admirers.
**Accounts are real.** You sign up with a one-time code sent to your email (Supabase email
OTP), finish a 3-step onboarding that saves to Postgres, and log in with a password (email or
username) or an email code. SMS and WhatsApp codes are built in but stay hidden until a provider
is configured and switched on. **Everything inside the app is still a prototype**, running on
clearly labeled, fictional demo data held in memory. Feed posts, likes and messages are not saved.

## Run

```bash
npm install
cp .env.example .env.local   # then add your Supabase URL + publishable key
npm run dev        # http://localhost:3000
npm run lint
npx tsc --noEmit
npm test           # one-time-code flow, schema, onboarding-step and route-rule unit tests (node:test)
npm run build
```

Without Supabase env vars the public pages render, sign-in forms show a configuration error,
and every member-only route redirects to `/login` (fail closed). Feed, Discover, profiles and
stories stay browsable.

## Database: apply migrations and test policies

`supabase/migrations/0001` – `0003` are **drafts, not applied** to any project yet.
Onboarding, and anything else that reads `profiles`, needs all three. Until they're applied,
signed-in members are sent to `/onboarding`, which shows "Profile setup isn't available right
now" (the gate failing closed). Guests can still browse. None of the migrations deletes or
rewrites existing data.

Try them on a **local or development** project first, never straight on production:

```bash
npm i -D supabase              # or install the Supabase CLI another way; the local stack needs Docker
npx supabase init              # creates supabase/config.toml; keeps the existing migrations
npx supabase start             # local stack (prints the API URL, keys and the email inbox URL)
npx supabase db reset          # applies 0001–0003, then supabase/seed.sql (fictional, local only)
npx supabase test db           # runs supabase/tests/database/*.test.sql (pgTAP, 88 checks)
```

For a hosted development project: `npx supabase link --project-ref <ref>`, then
`npx supabase db push`. It lists the pending migrations and asks before applying them, and it
doesn't run `seed.sql` unless you pass `--include-seed` (don't). `docs/PERMISSIONS.md` maps each
allowed and denied case to its test.

## Supabase Auth setup (email codes)

Sign-up and code log-in send a 6-digit code by email: `signInWithOtp({ email, options:
{ shouldCreateUser: true } })` to send, and `verifyOtp({ email, token, type: "email" })` to check.
Supabase generates, sends and checks the code. The app never stores or logs it.

1. **Project Settings → API Keys**: copy the project URL and the **publishable** key into
   `.env.local`. Optionally add a **secret** key as `SUPABASE_SECRET_KEY` (server-only; the
   legacy `SUPABASE_SERVICE_ROLE_KEY` also works). It enables log-in with a username and
   profile photo uploads. Never put it in a `NEXT_PUBLIC_` variable or in `.env.example`.
2. **Authentication → Sign In / Providers → Email**: enabled, with **Confirm email ON**. The
   app treats an email in the session as verified, and that only holds while confirmation is
   required (the database re-checks `email_confirmed_at` anyway). Keep "Allow new users to sign
   up" on. **Email OTP length: 6**, so the code field submits itself at 6 digits. **Email OTP
   expiration**: 900–3600 s. The same setting also applies to password reset links. Minimum
   password length: **10**.
3. **Authentication → Emails → Templates**: give **both** *Magic link* and *Confirm signup*
   the subject "Your Vernant code" and the body from `supabase/templates/otp-code.html`. It
   prints `{{ .Token }}` and has no link. Supabase emails new (or unconfirmed) addresses with
   *Confirm signup* and existing ones with *Magic link*, so both need the code. If either still
   sends only a link, that link still works through `/auth/confirm`, but only in the same browser.
   *Reset password* stays a link:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
4. **Authentication → URL Configuration**: Site URL (`http://localhost:3000` locally, your
   production origin in production). Redirect URLs: `http://localhost:3000/auth/confirm` and
   `https://<your-domain>/auth/confirm`.
5. **Authentication → Rate Limits**:
   - Defaults: one code per address every 60 s (the resend countdown matches), an hourly cap
     on emails sent, and per-IP buckets for code requests and verifications.
   - The app adds its own limits per server instance (`lib/auth/otp.ts`): 5 code requests per
     address and 20 per IP every 15 minutes, and 10 code attempts per address.
   - Supabase's per-IP limits apply to the **server's** IP, because these calls come from
     server actions. That means all visitors share one bucket. Before real traffic, enable
     *IP address forwarding* there and forward the visitor's IP (not wired yet).
6. **Authentication → Attack Protection → CAPTCHA**: recommended before launch. **Not wired in
   the app yet.** Turning it on in the dashboard alone breaks code requests and log-ins until
   the forms send a captcha token.
7. **Production email: custom SMTP (required before inviting anyone).** Supabase's built-in sender is for
   testing only. It **delivers only to addresses on your Supabase team**; everyone else gets
   "We can't email that address right now". It also allows only a few emails per hour. To fix that:
   - Pick a provider (Resend, Postmark, Amazon SES, SendGrid, Mailgun…).
   - Verify your sending domain with SPF, DKIM and DMARC.
   - In **Authentication → Emails → SMTP Settings**, enter the host, port (465 or 587),
     username, password, sender address (e.g. `no-reply@your-domain`) and sender name.
   - Then raise *Rate limit for sending emails* (it starts at 30 per hour) to the volume you expect.

### Test email codes locally

**Against your hosted project, with no SMTP:**
1. Do steps 2–4 above.
2. `npm run dev`, then sign up at `/register` with an address that is on your Supabase team
   (the built-in sender delivers nowhere else).
3. Enter the 6-digit code from the email. You land on `/onboarding`, which needs migrations
   0001–0003 applied to that project.

**Fully local (Docker):**
1. Run `npx supabase start` and point `.env.local` at the printed API URL and publishable (anon) key.
2. Add this to `supabase/config.toml`, then run `npx supabase stop && npx supabase start`:

   ```toml
   [auth]
   site_url = "http://localhost:3000"
   additional_redirect_urls = ["http://localhost:3000/auth/confirm"]

   [auth.email]
   enable_confirmations = true   # the CLI default is false; keep it like production
   otp_length = 6
   otp_expiry = 900
   max_frequency = "60s"

   [auth.email.template.magic_link]
   subject = "Your Vernant code"
   content_path = "./supabase/templates/otp-code.html"

   [auth.email.template.confirmation]
   subject = "Your Vernant code"
   content_path = "./supabase/templates/otp-code.html"
   ```

3. Nothing leaves your machine. Every email lands in the local inbox at
   `http://127.0.0.1:54324`. Sign up with any address, read the code there, and finish
   onboarding. `npx supabase test db` runs the permission tests.

### Optional: phone codes (SMS / WhatsApp)

These stay **hidden and refused by the server** until you set `AUTH_SMS_ENABLED=true` and/or
`AUTH_WHATSAPP_ENABLED=true`. Only do that after the channel is configured in Supabase and
you've received a real code with it. With them on, the sign-up and log-in forms show a channel
switch. The code is `signInWithOtp({ phone, options: { channel } })` +
`verifyOtp({ phone, token, type: "sms" })`. In Supabase, turn on the **Phone** provider, choose
**Twilio** or **Twilio Verify** (the only ones that can deliver WhatsApp), and keep phone
confirmations on. `/verify-phone` (adding a number to an account by SMS) follows
`AUTH_SMS_ENABLED` too.

**WhatsApp option A: Twilio Verify (simplest).**
1. Twilio Console → Verify → Services: create a service and note its **Service SID** (`VA…`).
2. Enable the **WhatsApp** channel for that service. For production, Twilio may require you to
   connect your own WhatsApp Business sender.
3. Optional but recommended: enable Fraud Guard, and restrict geo-permissions to the countries you serve.
4. Supabase → Phone provider: pick **Twilio Verify** and enter the Account SID, Auth Token and
   Verify Service SID. Twilio Verify controls the code length and expiry, and re-sends the
   *same* code while that code is still valid.

**WhatsApp option B: Twilio Programmable Messaging.**
1. Register a WhatsApp sender with [Twilio's WhatsApp self sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)
   (needs a Meta Business account and display-name approval).
2. Create an **authentication** Content Template, wait for WhatsApp to approve it, and note
   its **Content SID** (`HX…`).
3. Create a Messaging Service that uses the WhatsApp sender, and note its SID (`MG…`).
4. Supabase → Phone provider: pick **Twilio** and enter the Account SID, Auth Token, Message
   Service SID and **Twilio Content SID**.

For SMS only, any of Twilio, Twilio Verify, MessageBird, Vonage or Textlocal works. Configure it
in the Phone provider and set `AUTH_SMS_ENABLED=true`.

## Sign-up and auth flow

| Step | Where | What happens |
| --- | --- | --- |
| 1. Email | `/register` | Email address (a phone number instead only if a phone channel is enabled) → `requestSignInCode` → `signInWithOtp`. |
| 2. Verify | `/register` | The masked address, a code field (accepts paste, submits itself at 6 digits), a 60 s resend countdown, and "Change email". `verifySignInCode` → `verifyOtp` (type `email`) starts the session. |
| 3. Account | `/onboarding` | Username with a live availability check; an optional password, so username + password log-in works; Terms/Privacy consent → `save_account()` RPC, which creates or resumes the profile. |
| 4. Profile | `/onboarding` | All optional: photo (processed on the server and held for review), bio, pronouns, city, identities, interests, and what you're looking for. |
| 5. Preferences | `/onboarding` | All optional: "show me", age range, distance, visibility, and the distance and online switches → `complete_onboarding()`. |
| Done | `/onboarding` | Success screen → `next`, or `/discover` if none. |

- **Same flow for everyone:** a new address gets an account when its code is verified, and an
  existing one (including accounts from the older email + password sign-up) just logs in.
  Nothing reveals which. Finished accounts pass straight through `/onboarding` to `next`.
- **No duplicates:** the profile is created only after verification, by `save_account()`. It's
  keyed on the user's own id, so refreshes and repeated submissions can't create a second
  profile. Usernames are unique regardless of case.
- **Resuming:** every onboarding step saves before moving on, and a refresh or a new log-in
  resumes at the first unsaved step.
- **Locked until finished:** signed-in accounts that haven't finished are sent back to
  `/onboarding` from every page, and RLS hides them from all social data.

| Path | Purpose |
| --- | --- |
| `src/proxy.ts` → `lib/supabase/proxy.ts` | Refreshes the session cookie (`getClaims()`). Lets guests browse `/feed`, `/discover`, `/profile/<username>` and `/stories/<id>`, and sends everything else to `/login` (rules in `lib/auth/paths.ts`). |
| `lib/auth/otp.ts` | The one-time-code flow: which channels are on, validation, app-side rate limits, and the `signInWithOtp` / `verifyOtp` calls (Supabase client passed in, so it's unit-tested). |
| `lib/auth/actions.ts` | Server actions: one-time code request and verify; password log-in (email, or username resolved to email or phone by `login_identity()`); password reset; sign-out. |
| `lib/onboarding/actions.ts` | Username check, account, profile, photo upload and removal, preferences + completion. The user id comes from the session, never from the form. |
| `app/(auth)/login` | Tabs for password or email code. |
| `app/(auth)/verify-phone` | Add a number by SMS. Shows "not available" unless `AUTH_SMS_ENABLED=true`. |
| `components/auth/require-user.tsx` | `RequireUser` checks on the server, in order: session, verified email or phone, finished onboarding. `ResumeOnboarding` does the onboarding redirect on guest-browsable layouts. |
| `components/auth/member-gate.tsx` | Guest vs. member UI on browse pages (a join prompt instead of like, follow, comment…). UI only. |

**The legal documents don't exist yet.** Step 3 asks people to agree to the Community Guidelines,
Terms of Service and Privacy Policy, but none of them is written, so nothing is linked. Before
launch, publish them, link them from the consent text, and bump `TERMS_VERSION` in
`lib/onboarding/schemas.ts`.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Lucide · Radix (`radix-ui`) · Supabase Auth via `@supabase/ssr` · Zod.

## Structure

```
src/
  app/
    page.tsx                 Landing
    (auth)/register          Steps 1–2: email → one-time code
    (auth)/login             Password or email code
    onboarding/              Steps 3–5: account, profile, preferences (saved to Postgres)
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
    auth/                    Log-in and one-time-code forms, onboarding flow, step indicator, member gate
  lib/
    types.ts                 Domain types (mirror the planned schema)
    demo/                    DEMO ONLY: data.ts, in-memory store, simulated latency
    supabase/                Browser/server clients + proxy session refresh (publishable key only)
    auth/                    Server actions, Zod schemas, route rules, session helpers
    onboarding/              Onboarding actions, schemas, step logic, draft loader
    media/                   Server-side photo processing (sharp: check, strip EXIF, re-encode)
supabase/migrations/         DRAFT schema + RLS + storage policies (0001–0003; not applied)
supabase/tests/database/     pgTAP permission tests
supabase/seed.sql            Fictional, local-only seed data
supabase/templates/          Email template for one-time codes ({{ .Token }})
docs/ARCHITECTURE.md         Security & data-access plan
docs/PERMISSIONS.md          Permission test matrix
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
