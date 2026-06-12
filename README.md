# MARKD

**School, handled.** A student academic dashboard for GCSE / IGCSE / IB / A-Level students: subjects, tasks, deadlines, exams, past papers, goals, portfolio, extracurriculars, a focus timer, an AI study assistant and calendar import — one codebase, three platforms (iOS, Android, web).

Built to the spec in [MARKD_BUILD_PROMPT.md](./MARKD_BUILD_PROMPT.md). Design language: **INK & VOLT** — see [DESIGN.md](./DESIGN.md).

## Quick start (zero config)

```bash
npm install
npm run web      # or: npm start → press i / a for iOS / Android
```

With no environment configured the app boots straight into **demo/guest mode**: everything runs on-device (no Supabase writes, no credentials — spec §7.18). Onboard, then *Settings → Load sample data* to see the dashboard fully lit.

## Connecting the backend

1. `cp .env.example .env` and fill `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Local stack: `npm run db:start` then `npm run db:reset` (applies `supabase/migrations` + seed).
3. Edge Function secrets: see the full table in [supabase/functions/SETUP.md](./supabase/functions/SETUP.md) (Anthropic key, Stripe, RevenueCat, CRON_SECRET…).
4. Deploy functions: `supabase functions deploy <name>` (`--no-verify-jwt` only for `stripe-webhook` + `revenuecat-webhook`).
5. RLS proof: `npm run db:test` runs 231 pgTAP assertions (per-table user isolation, plan-column protection, share RPC, rate limiting).

## Scripts

| Command | What |
|---|---|
| `npm run test` | Vitest — 54 unit tests on the pure logic (parser, ranking, recurrence, streak/XP, dates, schemas) |
| `npm run typecheck` | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint (expo config) |
| `npm run e2e:web` | Playwright critical flow (boots Expo web itself) |
| `npm run e2e:mobile` | Maestro flow (needs a built app on sim/emulator) |
| `npm run db:test` | pgTAP RLS isolation suite |
| `npm run db:typegen` | Regenerate `src/db/types.gen.ts` from the live schema |
| `npm run export:web` | Production web build (deploy `dist/` to Vercel) |

## Architecture

```
app/                  expo-router routes (universal: web + native)
src/components/       INK & VOLT design system (Slab, Stamp, Sheet, …)
src/features/<domain> feature logic + components (auth, tasks, ai, …)
src/hooks/            TanStack Query hooks (useTasks, useGamification, …)
src/lib/backend/      THE data seam: one interface, two backends
src/db/schemas.ts     Zod schemas — single validation truth for all entities
src/utils/            pure, unit-tested logic (NLP parser, ranking, streaks)
supabase/migrations   schema + RLS (deny-by-default) + triggers + storage
supabase/functions    9 Deno Edge Functions (AI, webhooks, GDPR, calendar)
supabase/tests        pgTAP isolation proofs
e2e/                  Playwright (web) + Maestro (mobile)
```

**The data seam.** Every screen talks to `useBackend()` — an interface with two implementations. Guest mode gets `LocalBackend` (persisted on-device, mirrors FK cascades, soft-deletes into a local deletion log). Signed-in gets `SupabaseBackend` (RLS-enforced). Hooks layer optimistic updates + offline persistence (TanStack Query persisted cache, mutations pause offline and replay) on top, so **every feature works in both modes and offline**.

**Sign-up migration.** Guest data can be pushed into a fresh account after auth (spec §7.18) — see `LocalBackend.exportAll()`.

**AI.** All Claude calls run server-side in Edge Functions (spec §8): `ai-chat` streams SSE with a 3-block cached system prompt and six RLS-scoped tools; `ai-syllabus-breakdown` (Pro) turns PDFs into topic trees; `daily-motivation` runs nightly via pg_cron. Keyless/guest builds get a clearly-labelled offline demo responder — never fake AI.

**Money.** RevenueCat is the entitlement source of truth; `stripe-webhook` (web checkout) and `revenuecat-webhook` (IAP) mirror into `subscriptions` + `profiles.plan`. Client gates via `useEntitlement()` / `useQuotaGate()` route to the paywall; every paid Edge Function re-checks server-side.

## Spec deviations (documented)

- **`calendar_events` table** — the spec requires imported events to persist + surface in Timeline but defines no table for them; added with owner-only RLS (see `supabase/README.md`).
- **Charts are hand-rolled SVG** (`TrendChart`) instead of a chart lib — the spec's "e.g. Victory Native" allows discretion; native Skia setup costs outweighed it for one trend line.
- **Component tests** — the pure-logic layer is covered by Vitest (54 tests); RN component testing is deferred to the Playwright/Maestro flows (React 19 + RNTL/vitest interop is still rough).
- **`react-native-pdf`** — inline native PDF rendering swapped for signed-URL viewing (in-app browser on native, new tab on web) to stay Expo-Go-compatible; revisit with a dev build.

## Release

- **Stores**: `eas build` / `eas submit` (bundle ids `com.markd.app`; Apple Sign-In capability is configured in app.json).
- **Web**: `npm run export:web` → deploy `dist/` (Vercel). CI deploys `main` automatically when `VERCEL_TOKEN` is set.
- **OTA**: `eas update` on merge to main (wired in CI behind `EXPO_TOKEN`).
