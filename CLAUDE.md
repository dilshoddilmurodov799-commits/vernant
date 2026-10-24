# Vernant

Adult-only (18+) dating and social web platform: visual social feed and stories, discovery and matching, real-time messaging.
Built in milestones. Do only the current milestone prompt and don't implement ahead.

> UI copy is branded Vernant (temporary wordmark in `components/ui/logo.tsx`). Demo image keys still use a legacy `hearth-*` prefix; they're internal IDs only.

## Stack
- Next.js 16 App Router with `cacheComponents` + `partialPrefetching` enabled, React 19, strict TypeScript, Tailwind CSS 4 (tokens in `src/app/globals.css` `@theme`), Lucide icons, Radix (`radix-ui`) for complex interactive primitives (shadcn/ui-style ports in `components/ui/`, styled with Vernant tokens — not the shadcn token set).
- Supabase (Auth, Postgres, Storage, Realtime) via `@supabase/ssr`. Auth is live (`src/proxy.ts`, `src/lib/auth/`); in-app data is still demo. Use Zod (installed) for all server-side input validation.
- Package manager: **npm**. Path alias `@/*` → `src/*`.
- Next 16 differs from older versions. Check `node_modules/next/dist/docs/` before relying on memory. `params` is a Promise. Read URL data (`params`, `searchParams`) behind Suspense: route `loading.tsx` files provide it.

## Commands
```bash
npm run dev          # local dev
npm run lint         # ESLint (next core-web-vitals + TS, react-hooks v7 rules)
npx tsc --noEmit     # type-check
npm run build        # production build — must pass before finishing
```
```bash
npm test             # tsc → node:test on src/**/*.test.ts (pure modules only, relative imports, no @/ alias)
```
Vitest was the plan but couldn't be installed offline; migrate these tests to it when convenient. Use pgTAP (`supabase test db`) for RLS.

## Layout
- `src/app/(auth)`, `onboarding`, `(app)/*` (signed-in shell), `stories/[id]`. Pages stay thin and render a view component.
- `src/components/ui/`: the design system (Button, Avatar, Photo, Field, Dialog, DropdownMenu/Menu, Badge/Chip/Segmented/Switch, Empty/Error/Skeleton, Toast, ThemeToggle). Reuse these before creating new primitives. `/design` renders all of them. Update it when adding or changing a primitive.
- `src/lib/theme/`: `config.ts` (server-safe constants + pre-paint script) and `use-theme.ts` (client store). Theme = `data-theme` on `<html>`, persisted in `localStorage["vernant-theme"]`, default dark.
- `src/components/<feature>/`: feature views. `safety/` holds the report and block dialogs.
- `src/lib/types.ts`: domain types that mirror the DB schema.
- `src/lib/demo/`: **DEMO ONLY** (fictional data, in-memory store, simulated latency). Keep it labeled as demo. Replace it screen by screen with real queries and delete the demo pieces once a screen is wired.
- `src/lib/supabase/`: browser and server clients + proxy session refresh (publishable key only).
- `src/lib/auth/`: server actions, Zod schemas, route rules (`paths.ts`, fail closed), `session.ts` (`getCurrentUser`/`requireUser`). Protected trees wrap children in `<Suspense><RequireUser>`.
- `supabase/migrations/`: schema + RLS + storage policies. `0001` is a **draft, never applied**.
- `docs/ARCHITECTURE.md`: the security and data-access plan. Keep it current.

## Working rules
- Inspect the relevant files and their callers before editing. Preserve working behavior and existing conventions.
- Prefer simple, focused changes that reuse existing components. No speculative abstractions, rewrites, or unneeded dependencies.
- Large tasks: inspect, write a short plan, implement in small stages, verify each stage, summarize.
- Never claim tests pass, features work, or backends are integrated without having verified it. Label demo and mock behavior as such in the UI and in code.
- Never remove features, disable lint or type rules, skip checks, or weaken RLS to make a build pass.
- Before finishing, run lint, type-check, the relevant tests, and the build. Fix any failures your change caused and report anything left unresolved.
- Update `README.md`, `docs/ARCHITECTURE.md`, and `.env.example` whenever behavior, setup, or env vars change.

## Security (non-negotiable)
- **Secrets:** no real secrets in committed files. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may reach the browser. `SUPABASE_SERVICE_ROLE_KEY` is server-only: import it from `server-only` modules and never prefix it with `NEXT_PUBLIC_`.
- **Authorization:** enforce it on the server **and** in RLS. UI checks are UX, not security. Every table has RLS enabled, and no table is readable by `anon`.
- **Validation:** validate all untrusted input server-side with Zod: server actions, route handlers, RPC args. Enforce limits in DB constraints too.
- **Trust-sensitive writes:** matches, conversation creation, verification, moderation actions, and account deletion go through server code or `SECURITY DEFINER` functions with `set search_path = ''`. Clients never write these directly.
- **Private data:** never expose birth dates, email addresses, precise location, IP addresses, or report contents to other users. Expose derived age and approximate distance only. Never log private user data.
- **Media:** keep it in private buckets and serve it through short-lived signed URLs. Before an upload is referenced: validate MIME and size, strip EXIF/GPS, and run the moderation scan.

## Trust & safety requirements
- **18+ only:** check age at sign-up (client + DB trigger) and treat every user as an adult. Plan for verification and for handling reports that someone appears to be under 18.
- **Blocking:** symmetric, enforced in SQL (`is_blocked()`), and applied to profiles, posts, stories, likes, messages, and media.
- **Reporting:** available from every profile, post, and conversation. Reports are write-only for members, and moderators read them via the service role.
- **Privacy:** respect profile visibility (everyone, members, matches), messaging permissions, show distance and online status, incognito, and private album grants (revocable).
- **Moderation:** design new features with abuse in mind (rate limits, audit trail, moderation queue).

## Tests
Add tests for meaningful logic and anything security-sensitive. Priorities: RLS policies (especially block and visibility edge cases), age checks, input schemas, match and permission logic.

## UI conventions
- Dark-first premium look with a matching light theme. Use semantic tokens only (`bg-surface`, `text-muted`, `border-line`, `bg-accent`, `shadow-elevated`, …). Never put raw hex values in components; add or adjust tokens in both theme blocks of `globals.css`, and keep text pairings at WCAG AA or better. White or black is fine only as text/scrims over photos. The accent color is restrained: avoid gradients, heavy blue, clutter, and emoji-heavy UI.
- Every data view needs loading, empty, and error states. Keep it responsive (mobile tab bar, desktop sidebar), accessible (labels, roles, focus states), and respectful of reduced motion.
