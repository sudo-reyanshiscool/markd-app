# Build Prompt — “MARKD” Student Academic Dashboard

You are an expert full‑stack engineer. Build a production‑quality application called **Markd** from scratch, end to end, following this specification exactly. Ship it on **web, iOS, and Android from a single codebase**. This document defines *what to build and how it must behave* (features, functions, data, architecture). It does **not** prescribe a visual design — that is yours to invent. Treat every functional requirement below as binding, and treat the design as a wide‑open canvas to be bold and original with (see **Creative direction** immediately below).

---

## Creative direction — the design is yours to invent

Everything in this document specifies *behaviour and data*. **The entire visual and interaction design is yours — be ambitious, original, and a little daring.** Do not reach for a generic, templated admin‑dashboard look. Give Markd a distinctive point of view and a memorable identity that a teenager would genuinely want to open every day. When in doubt, make the more interesting choice.

You have **full creative ownership** of:

- **Visual identity** — palette, typography, iconography, the logo/wordmark treatment for the “Markd” name, illustration and graphic style, and **both light and dark themes** (design each as intentional and first‑class, not a mechanical inversion).
- **Layout & composition** — how every screen is framed. Invent *signature* layouts for the Home dashboard, Subjects, and Timeline rather than stacking stock cards in a plain list.
- **Motion & micro‑interactions** — Reanimated and Gesture Handler are already in the stack; lean on them hard. Animate screen transitions, task completion, streak/XP gains, the focus timer, drag‑to‑reorder, and every empty / loading / success state so the app feels alive and responsive.
- **Personality & voice** — copy tone across onboarding, empty states, the daily motivation, and reward moments. Streaks and level‑ups should feel celebratory and worth sharing.

Push it. Surprise the user. Treat the Home screen, the focus timer, and the streak/XP system as opportunities for something genuinely delightful and screenshot‑worthy.

**The only non‑negotiables** (creativity must not break these):

- **Clarity first.** This is a productivity tool — a student must instantly see *what to do next*. Never trade legibility or findability for spectacle.
- **Accessibility.** Sufficient contrast, adequate touch targets, screen‑reader labels, and honour the OS reduced‑motion preference.
- **Cross‑platform & responsive.** One coherent design that adapts gracefully across phone, tablet, and web, respecting each platform’s core conventions (gestures, safe areas, navigation patterns).
- **Performance.** Keep animations at ~60fps and never block interaction behind them.
- **Cohesion.** Build a real, reusable design system — design tokens + shared primitives — not one‑off styling per screen.

In short: the functional spec is binding; the look, feel, motion, and personality are your canvas. Be bold.

---

## 0. Mission

Markd is a **student academic dashboard**: one place for a secondary‑school student to manage subjects, tasks, deadlines, exams, past papers, goals, portfolio, extracurriculars, a study/focus timer, an AI study assistant, and calendar import. It must be fast, offline‑capable, secure (strict per‑user data isolation), and monetised with a freemium model.

Hard requirements that shape every decision:

- **One codebase, three platforms.** Real native components on iOS/Android (not a wrapped webview) plus a real responsive web build.
- **Strict multi‑tenancy.** Every row belongs to exactly one user and is unreachable by any other user, enforced at the database layer (Row‑Level Security), not just in app code.
- **No money‑costing operation runs unauthenticated or unmetered.** Every server endpoint validates the user and rate‑limits.
- **Offline‑first.** The app is usable without a network; writes queue and sync.
- **No secrets, demo credentials, or API keys in client source.** All privileged work happens server‑side.

---

## 1. Audience & scope

- **Users:** Secondary‑school students worldwide on GCSE / IGCSE / IB / A‑Level (and an “Other” track). Public self‑service sign‑up. School‑agnostic.
- **Language:** English at launch, but fully internationalised (i18n) so other languages can be added without code changes.
- **Tone:** A focused productivity tool for teenagers — encouraging, low‑friction, fast.

---

## 2. Technology stack

Use this stack. It is chosen so one codebase covers all three platforms and so the backend enforces security centrally.

| Layer | Choice | Notes |
|---|---|---|
| App framework | **Expo (SDK 54+) + expo‑router v6+** | File‑based routing; builds native iOS/Android and web via React Native Web. |
| Language | **TypeScript (strict)** | Enable `strict` and `noUncheckedIndexedAccess`. No `any` in committed code. |
| Styling system | **NativeWind 4 (Tailwind for RN)** | Utility styling that works on native + web. (Pick the actual color/type values yourself — out of scope here.) |
| Server state | **TanStack Query v5** | Caching, retries, optimistic updates, offline persistence. |
| Client state | **Zustand** | UI state, drafts, focus‑timer, theme, consent. Persisted via MMKV on native / `localStorage` on web. |
| Forms + validation | **react‑hook‑form + Zod** | Zod schemas are shared between forms and the data layer. |
| Backend | **Supabase** | Postgres, Auth, Storage, Edge Functions, Realtime. |
| AI | **Anthropic Claude via Supabase Edge Functions** | Latest Claude Sonnet for paid, latest Claude Haiku for free. Server‑side only, with prompt caching. |
| Payments | **RevenueCat** (iOS/Android IAP) **+ Stripe** (web) | RevenueCat entitlements are the single source of truth. |
| Push & background | **Expo Notifications + expo‑task‑manager** | Local + remote notifications, background calendar sync. |
| Calendar | **expo‑calendar** (native read) **+ Edge Function** for `.ics` URLs | |
| Files | **Supabase Storage** | Syllabus PDFs and avatars. Never store binary blobs in the database. |
| Errors | **Sentry** | Releases + source maps. |
| Analytics | **PostHog** | **Opt‑in only**, behind an explicit consent dialog. |
| Lists | **FlashList** | Virtualised long lists (timeline, tasks). |
| Charts | A React‑Native‑compatible chart lib (e.g. Victory Native) | Papers trend, subject health. |
| PDF viewing | A React‑Native PDF viewer (e.g. react‑native‑pdf) + `pdfjs‑dist` server‑side for text extraction | |
| Build & release | **EAS Build / Submit / Update** | App stores + OTA updates. |
| Web hosting | **Vercel** | |
| Testing | **Vitest** (unit), **Playwright** (web E2E), **Maestro** (mobile E2E), **pgTAP** (RLS) | |
| CI | **GitHub Actions** | |

---

## 3. Repository architecture

```
app/                         expo-router routes (universal)
  _layout.tsx                root providers + auth/onboarding gate
  index.tsx                  entry redirect
  (auth)/                    sign-in, sign-up, reset
  (tabs)/                    home, tasks, timeline, subjects, more
  onboarding/                name → school → track → year-group → first-subject → finish
  paywall.tsx
  share/[slug].tsx           public read-only shared view
  +not-found.tsx
src/
  components/                shared primitives (Screen, Button, Input, Card, Modal, Sheet, ConsentDialog…)
  features/                  one folder per domain (auth, subjects, tasks, deadlines, exams, papers,
                             goals, portfolio, activities, syllabus, ai, calendar, focus-timer,
                             paywall, share, settings, home). Each holds its api.ts + components + logic.
  lib/                       supabase, api wrappers, storage abstraction, notifications, revenuecat,
                             stripe, posthog, sentry, i18n, entitlements
  hooks/                     TanStack Query wrappers (useSession, useProfile, useSubjects, useTasks…)
  stores/                    zustand stores (ui, drafts, focus-timer, theme, consent, onboarding)
  db/                        schemas.ts (Zod for every entity) + types.gen.ts (generated from Supabase)
  utils/                     date, format, email, NLP task parser, priority ranking
  constants/                 exam tracks, year groups, plans, curricula/boards
  locales/                   en.json (+ future languages)
supabase/
  migrations/                versioned SQL: schema, RLS, indexes, triggers, storage, seed
  functions/                 ai-chat, ai-syllabus-breakdown, daily-motivation, calendar-import,
                             stripe-webhook, revenuecat-webhook, share-create, data-export,
                             account-delete
  tests/                     pgTAP RLS isolation tests
e2e/                         Playwright (web) + Maestro (mobile)
```

Conventions: feature logic lives in `src/features/<domain>`; never put data access in route files. All Supabase reads/writes go through typed wrappers and are consumed via TanStack Query hooks. All validation uses the shared Zod schemas in `src/db/schemas.ts`.

---

## 4. Data model

Postgres via Supabase. **Rules that apply to every table below:**

- Every user‑owned table has `user_id uuid not null references auth.users(id) on delete cascade`.
- **Row‑Level Security is enabled on every table, deny‑by‑default**, with explicit `select / insert / update / delete` policies keyed on `auth.uid() = user_id`. Storage bucket policies match the same ownership rule.
- Primary keys are `uuid default gen_random_uuid()` unless they mirror `auth.users` (profiles).
- Timestamps are `timestamptz`. `created_at` defaults to `now()`. Where listed, `updated_at` is maintained by a trigger.
- A trigger maintains `updated_at` on: `profiles`, `subjects`, `ai_conversations`, `subscriptions`.
- A trigger `handle_new_user` runs `after insert on auth.users` and inserts a `profiles` row with `id = new.id` and `email = lower(new.email)` (`on conflict do nothing`).

### Tables

**`schools`** — `id`, `name` (not null), `domain`, `country`, `verified bool default false`, `created_by uuid → auth.users (set null)`, `created_at`. User‑submitted schools are `verified=false` until an admin verifies. Searchable by name; index `domain`.

**`profiles`** — `id uuid pk → auth.users (cascade)`, `email not null`, `name`, `school_id → schools (set null)`, `country`, `year_group text` (e.g. “Year 11”, “DP1”, “Lower Sixth”), `exam_track text check in (gcse,igcse,ib,alevel,other)`, `onboarded_at`, `plan text default 'free' check in (free,pro,family)`, `revenuecat_id`, `stripe_customer_id`, `theme text default 'system' check in (system,light,dark)`, `revision_mode bool default false`, `locale text default 'en'`, `legacy_migrated_at`, `created_at`, `updated_at`. `plan` mirrors the entitlement; the canonical subscription state lives in `subscriptions`.

**`subjects`** — `id`, `user_id`, `name not null`, `board`, `target_grade`, `color`, `position int default 0` (for drag‑to‑reorder), `archived_at` (soft archive), `created_at`, `updated_at`.

**`subject_specs`** — syllabus files. `id`, `subject_id → subjects (cascade)`, `user_id`, `year`, `storage_path not null`, `file_name not null`, `mime not null`, `size_bytes int not null`, `created_at`.

**`tasks`** — `id`, `user_id`, `subject_id → subjects (set null)`, `text not null`, `done bool default false`, `priority int default 3 check between 1 and 5`, `estimate_minutes int`, `topic`, `due_date date`, `recurrence jsonb` (rrule‑style, nullable), `snoozed_until timestamptz`, `created_at`, `completed_at`.

**`deadlines`** — `id`, `user_id`, `subject_id → subjects (set null)`, `title not null`, `date date not null`, `notes`, `created_at`.

**`exams`** — `id`, `user_id`, `subject_id → subjects (set null)`, `name not null`, `board`, `date date not null`, `location`, `description`, `syllabus_text`, `syllabus_storage_path`, `ai_breakdown_json jsonb`, `created_at`.

**`papers`** — past‑paper attempts. `id`, `user_id`, `subject_id → subjects (set null)`, `title`, `year int`, `paper_number`, `scored numeric`, `total numeric`, `taken_on date`, `notes`, `created_at`.

**`goals`** — `id`, `user_id`, `subject_id → subjects (set null, nullable)`, `text not null`, `horizon text check in (3m,6m,9m,12m)`, `done bool default false`, `completed_at`, `created_at`.

**`portfolio_entries`** — `id`, `user_id`, `subject_id (nullable)`, `title not null`, `type text check in (project,achievement,competition,leadership)`, `description`, `tags text[] default '{}'`, `created_at`.

**`activities`** — extracurriculars. `id`, `user_id`, `name not null`, `role`, `organisation`, `hours_per_week numeric`, `description`, `color`, `tags text[] default '{}'`, `created_at`.

**`activity_events`** — `id`, `activity_id → activities (cascade)`, `user_id`, `title not null`, `date`, `description`, `created_at`.

**`topic_confidence`** — `id`, `user_id`, `subject_id → subjects (cascade)`, `topic not null`, `confidence int check between 0 and 100`, `updated_at`, **unique `(user_id, subject_id, topic)`**.

**`study_sessions`** — `id`, `user_id`, `subject_id (set null)`, `task_id → tasks (set null)`, `minutes int not null`, `started_at`, `completed_at default now()`.

**`ai_conversations`** — `id`, `user_id`, `title`, `created_at`, `updated_at`.

**`ai_messages`** — `id`, `user_id`, `conversation_id → ai_conversations (cascade)`, `role text check in (user,assistant,tool)`, `content not null`, `tool_calls jsonb`, `tokens_in int`, `tokens_out int`, `model text`, `created_at`. Index `(conversation_id, created_at)`.

**`daily_motivations`** — `id`, `user_id`, `date date not null`, `text not null`, `model`, **unique `(user_id, date)`**.

**`calendar_feeds`** — `id`, `user_id`, `url not null`, `label`, `last_synced_at`, `last_event_count int`, `status text default 'pending' check in (ok,error,pending)`, `last_error`, `created_at`.

**`deletion_log`** — soft‑delete / “recently deleted”. `id`, `user_id`, `entity_type` (e.g. `subject`, `task`), `entity_id`, `snapshot jsonb` (full row at deletion), `deleted_at`, `restored_at`. 30‑day retention via scheduled cleanup.

**`share_links`** — `id`, `user_id`, `slug text unique` (short, URL‑safe), `payload jsonb` (denormalised snapshot), `expires_at not null`, `view_count int default 0`, `created_at`.

**`device_tokens`** — `id`, `user_id`, `expo_push_token not null`, `platform text check in (ios,android,web)`, `created_at`, **unique `(user_id, expo_push_token)`**.

**`subscriptions`** — `id`, `user_id`, `source text check in (revenuecat,stripe)`, `product_id`, `status text check in (active,trialing,past_due,canceled,expired)`, `period_start`, `period_end`, `raw_event jsonb`, `updated_at`.

**`rate_limits`** — `user_id`, `key text` (e.g. `ai-chat`, `calendar-import`), `window_start timestamptz`, `count int default 0`, **primary key `(user_id, key, window_start)`**.

### Indexes (minimum)

All `user_id` FKs; `tasks(user_id, done, due_date)`; `deadlines(user_id, date)`; `exams(user_id, date)`; `ai_messages(conversation_id, created_at)`; `share_links(slug)` unique; `schools(domain)`.

### Storage buckets

- `syllabi` — **private**; RLS by `user_id` path prefix; downloads via signed URLs only.
- `avatars` — public read, owner write.

### Generated types

Generate TypeScript types from the live schema into `src/db/types.gen.ts` and keep them in sync. Mirror every entity with a Zod schema in `src/db/schemas.ts` (validation rules: subject `name` 1–80 chars; task `text` 1–500 chars; `priority` 1–5 default 3; enums match the DB checks above).

---

## 5. Authentication & account

- **Email + password** sign‑up, sign‑in, and password reset (Supabase Auth). Normalise emails (trim + lowercase) before every auth call.
- **Sign in with Apple** on iOS (required by App Store when offering social login): request EMAIL + FULL_NAME scopes, exchange the Apple identity token via Supabase `signInWithIdToken({ provider: 'apple' })`. Guard so it only runs on iOS.
- On first auth, the `handle_new_user` DB trigger creates the `profiles` row automatically.
- **Routing gate** (in the root layout): unauthenticated → `(auth)`; authenticated but `onboarded_at IS NULL` → `onboarding`; authenticated + onboarded → `(tabs)`.
- `useSession` and `useProfile` hooks expose the current auth session and profile via TanStack Query, and drive the gate.

---

## 6. Onboarding (exact flow)

A linear flow that ends by writing the profile, the first subject, and seed tasks. Persist a draft in a Zustand store so back/forward navigation keeps answers.

1. **Name** — free text; required.
2. **School** — typeahead search against `schools` by name (`ilike '%term%'`, verified schools first, limit 20). If not found, user adds a school (name + country) which inserts a `schools` row with `verified=false` and selects it.
3. **Country** — text/select (optional).
4. **Exam track** — choose one of: `GCSE, IGCSE, IB, A‑Level, Other` (stored as `gcse|igcse|ib|alevel|other`).
5. **Year group** — options depend on track:
   - GCSE / IGCSE → `Year 9, Year 10, Year 11`
   - IB → `MYP4, MYP5, DP1, DP2`
   - A‑Level → `Lower Sixth, Upper Sixth`
   - Other → `Year 9 … Year 13`
6. **First subject** — name + a color choice.
7. **Finish** — in order: (a) update `profiles` with name, school_id, country, exam_track, year_group, and `onboarded_at = now()`; (b) insert the first subject at `position 0`; (c) seed exactly three starter tasks on that subject:
   - “Skim this week’s lesson notes” (priority 3)
   - “Plan your study schedule” (priority 4)
   - “Try a past paper question” (priority 2)

   Then route to the main tabs.

---

## 7. Feature specifications

Each feature below is required. Implement full create/read/update/delete with optimistic updates and offline support unless stated otherwise. The five primary tabs are **Home, Tasks, Timeline, Subjects, More**; **More** is a hub linking to exams, papers, goals, portfolio, activities, syllabus, focus timer, AI, calendar, share, recently‑deleted, and settings.

### 7.1 Home (dashboard)
Aggregated overview built from the user’s live data:
- **“Do next” planner card** — the single highest‑ranked actionable task (see ranking in 7.3).
- **Streak** — consecutive days with at least one completed task or logged study session.
- **Level / XP** — a simple gamification score derived from completed tasks and study minutes; show current level and progress to next.
- **Weekly summary** — tasks completed, study minutes, papers logged this week.
- **Subject health grid** — per subject, a health signal from target grade vs recent paper scores and topic confidence.
- **Upcoming** — next deadlines/exams in date order.
- **Daily AI motivation** — one short line, generated once per day and cached in `daily_motivations` keyed `(user_id, date)`; Home reads today’s row (never regenerates on every load).

### 7.2 Subjects
CRUD. **Drag‑to‑reorder** (persist `position`) using Reanimated/Gesture Handler. Distinguish **archive** (set `archived_at`, hidden from active lists, restorable) from **delete** (soft‑delete to `deletion_log`). Each subject has optional board, target grade, and color.

### 7.3 Tasks
- **Quick‑add with natural‑language parsing.** A typed string like `"essay english fri 5pm 2h !"` parses into structured fields: match a known subject name → `subject_id`; weekday / relative words (`today, tomorrow, mon…sun, next week`) and explicit dates → `due_date`; times (`5pm`, `17:00`) → due time; durations (`2h`, `90m`) → `estimate_minutes`; priority markers (`!`, `!!`, `p1..p5`) → `priority`. Anything unmatched stays in `text`. Implement as a **pure, deterministic, unit‑tested** function in `src/utils`.
- **Priority ranking.** A pure scoring function ranks tasks for the planner combining: due‑date urgency (overdue > today > soon > later), explicit `priority` (1–5), and `estimate_minutes`. Snoozed (`snoozed_until` in the future) and `done` tasks are excluded. Must be deterministic and unit‑tested.
- **Recurrence** (`recurrence` jsonb, rrule‑style): completing a recurring task generates the next occurrence.
- **Snooze** sets `snoozed_until`. **Swipe‑to‑complete** on mobile; completing sets `done=true` + `completed_at`.

### 7.4 Deadlines
CRUD with a native date picker. Schedule **local notifications 1 day and 1 hour before** each deadline.

### 7.5 Timeline
A single chronological, **virtualised (FlashList)** stream merging tasks (by due date), deadlines, and exams — the student’s “what’s coming” view. Filter by subject.

### 7.6 Exams
CRUD: name, board, date, location, description, syllabus text or file. An **AI breakdown** action (Pro) calls the `ai-syllabus-breakdown` Edge Function and stores the resulting topic tree in `ai_breakdown_json`, rendered as an expandable topic/subtopic/skills/estimated‑hours view.

### 7.7 Papers
Log past‑paper attempts (title, year, paper number, scored/total, date, notes). Show a **score‑trend chart** over time per subject, and a **curated resources hub** linking to major exam boards and revision sites (AQA, Edexcel, OCR, IB, Save My Exams, etc.).

### 7.8 Goals
CRUD short‑/medium‑term goals with a `horizon` of 3/6/9/12 months, optional subject, and a done state with completion timestamp.

### 7.9 Activities (extracurriculars)
CRUD activities (name, role, organisation, hours/week, tags) plus **activity events** (dated milestones under an activity).

### 7.10 Portfolio
CRUD achievements/projects/competitions/leadership entries with tags and optional subject. **CSV/PDF export is a Pro feature.**

### 7.11 Syllabus library
Upload **PDF or text** syllabus files to the `syllabi` Storage bucket (record a `subject_specs` row with path, name, mime, size, year). **Inline PDF viewer.** An **AI breakdown** button (Pro) sends the file to `ai-syllabus-breakdown`.

### 7.12 Calendar import
Two paths:
- **Native calendar** via `expo-calendar` (read device calendars, no server proxy).
- **`.ics` URL** via the auth‑gated `calendar-import` Edge Function (supports `calendar.online`, `kalender.digital`, generic `.ics`). Store feeds in `calendar_feeds` with sync status/error. **Background sync** via `expo-task-manager`. Imported events surface in Timeline/Deadlines.

### 7.13 AI assistant
Chat with conversation history (`ai_conversations` + `ai_messages`), **streaming** responses, and **tool use**. Tools the model can call (all operating only on the signed‑in user’s data through RLS‑enforced queries): `get_subjects`, `get_upcoming_deadlines`, `get_topic_confidence`, `add_task`, `mark_done`, `log_study_session`. **Model is plan‑aware** (latest Claude Sonnet for paid, latest Haiku for free). All AI runs server‑side (7.x AI architecture). Persist every message with token counts and model.

### 7.14 Focus timer
Pomodoro presets (25 / 45 / 60 minutes). On completion, write a `study_sessions` row (minutes, optional subject/task). Feeds streak, XP, and weekly summary. Timer state in a Zustand store so it survives navigation.

### 7.15 Settings
Profile editing, **theme** (system/light/dark, persisted), notification preferences, **data export (GDPR)** and **delete account (GDPR)** — both via Edge Functions (`data-export`, `account-delete`). Show plan/subscription status and a manage‑subscription entry point.

### 7.16 Recently deleted
List `deletion_log` entries, allow **restore** (re‑insert from `snapshot`, set `restored_at`), 30‑day retention, then permanent purge via scheduled cleanup.

### 7.17 Share
Create a **public read‑only share link** (`share_create` Edge Function) producing a short `slug` and a denormalised `payload` snapshot, **expiring after 30 days**, with a view counter. Public route `share/[slug]` renders it without auth. Free users get no share link; Pro gets **1 active parent share link**.

### 7.18 Demo / guest mode
A fully local, no‑account mode backed by local state only — **no Supabase writes, no hardcoded credentials**. Persistent “Create an account to save your work” CTA. On sign‑up, optionally migrate the local draft into the account.

### 7.19 Themes
System / light / dark via the RN Appearance API, user‑overridable and persisted in `profiles.theme` + local store. Wire the switching mechanism robustly, and design **both** light and dark as intentional, first‑class themes (not a mechanical inversion) per the **Creative direction**.

### 7.20 Notifications
Local + push (Expo Notifications). Register device tokens into `device_tokens`. Notification types: **daily planner ping**, **deadline reminders (1d/1h)**, **streak‑save reminder**. Respect per‑user preferences from Settings.

### 7.21 Offline & sync
TanStack Query persistence + optimistic updates + a write queue that replays on reconnect. The app must be navigable and mutable offline; conflicts resolve last‑write‑wins per row unless a field needs smarter merging.

### 7.22 Internationalisation
All user‑facing strings come from `i18next` bundles (`src/locales/en.json` at launch). No hardcoded display strings in components.

---

## 8. AI architecture (Supabase Edge Functions)

All AI is server‑side, JWT‑validated, entitlement‑checked, and rate‑limited. Use **prompt caching** to control cost.

### 8.1 `ai-chat`
1. Validate the Supabase JWT.
2. Check entitlement and per‑user rate limit (`rate_limits`, key `ai-chat`).
3. Load recent conversation history from `ai_messages`.
4. Build the system prompt as **cached blocks**:
   - **Block 1 (cached, persistent):** app description + tool schemas.
   - **Block 2 (cached per‑user, refreshed daily):** user context (subjects, target grades, exam track).
   - **Block 3 (live):** recent state (next‑7‑day deadlines, top‑priority tasks).
5. **Stream** the Claude response over SSE (latest Sonnet for paid, latest Haiku for free).
6. Persist user + assistant messages with token counts and model.
7. Execute tool calls server‑side against the user’s data (RLS‑enforced), returning results to the model.

### 8.2 `ai-syllabus-breakdown`
1. Validate JWT + **Pro** entitlement.
2. Resolve `subject_specs.storage_path` → fetch the PDF → extract text with `pdfjs-dist` inside the function.
3. Prompt Claude (latest Sonnet, single shot, extended thinking) for a topic tree:
   ```json
   { "topics": [ { "name": "...", "subtopics": ["..."], "key_skills": ["..."], "estimated_hours": 0 } ] }
   ```
4. Persist to `exams.ai_breakdown_json` and return it for display.

### 8.3 `daily-motivation` (scheduled)
Runs nightly. For each active user, generate one short motivational line from their next exam + current streak; upsert into `daily_motivations` `(user_id, date)`. Home reads today’s row.

---

## 9. Monetization & entitlements

### Plans
| Plan | Price | Entitlements |
|---|---|---|
| **Free** | £0 | 3 subjects, 50 tasks, basic AI (Haiku, 50 messages/month), **no** calendar feeds, **no** syllabus AI breakdown, **no** exports, no share link. |
| **Pro** | £3.99/mo or £29/yr | Unlimited subjects/tasks, AI on the latest Sonnet with 2,000 messages/month, calendar feeds, syllabus AI breakdown, CSV/PDF exports, **1** active parent share link. |
| **Pro Family** | £49/yr | Up to **4** student accounts under one family; all Pro features per student; a parent dashboard aggregating across the four. |

- **7‑day free trial** on Pro and Family.
- **15% educational discount** for verified `.edu` / `.ac.uk` emails.

### Implementation
- **Mobile:** RevenueCat SDK; products configured in App Store Connect + Google Play.
- **Web:** Stripe Checkout + Billing portal; the `stripe-webhook` Edge Function mirrors entitlements into RevenueCat via its REST API.
- **Source of truth:** RevenueCat entitlements (read via SDK on mobile, REST on web). `subscriptions` + `profiles.plan` mirror it.
- **Server gating:** every cost‑incurring Edge Function (AI chat, syllabus breakdown, exports) re‑checks entitlement before doing work.
- **Client gating:** centralise feature flags in `src/lib/entitlements.ts`; expose `useEntitlement(key)` returning a boolean + a paywall trigger. Gated actions route to `paywall.tsx`.

---

## 10. Security & compliance

- Every Edge Function requires a valid JWT (`Authorization: Bearer <supabase token>`); reject otherwise.
- Every public‑facing/cost endpoint enforces per‑user rate limits via `rate_limits`.
- **Calendar import SSRF protection:** HTTPS‑only; deny private/loopback/link‑local ranges (RFC 1918, RFC 4193, link‑local, loopback); 5 MB response cap; 10 s timeout.
- **Consent‑gated analytics:** no third‑party tracking before the user opts in; PostHog opt‑in dialog on first launch.
- **GDPR:** `data-export` returns a zip of all the user’s rows + storage objects; `account-delete` cascades and removes everything.
- **No demo credentials or secrets in client source.** Demo data is local‑only state.
- App Privacy disclosures: data collected = email, opt‑in usage analytics, crash reports.
- Provide RLS isolation tests (pgTAP) proving user A cannot read or write user B’s rows on every table.

---

## 11. Testing

- **Unit (Vitest):** NLP task parser, priority ranking, date/format utils, email normalisation, Zod schemas, entitlement checks — all pure logic must be covered.
- **Component (RN Testing Library):** key feature components.
- **E2E web (Playwright):** sign‑up → onboarding → create subject → add task → complete task → streak updates → upgrade flow → AI chat.
- **E2E mobile (Maestro):** the same critical flows on an iOS simulator and Android emulator.
- **Edge Functions:** Deno tests against a local Supabase.
- **DB:** pgTAP RLS isolation tests.

---

## 12. CI/CD & deployment

- **On PR (GitHub Actions):** lint, typecheck, Vitest, Playwright web E2E, a Maestro mobile subset, and pgTAP.
- **On merge to `main`:** Vercel deploys web; EAS Update pushes the OTA bundle to matching runtime versions.
- **On version bump:** EAS Build → auto‑submit to TestFlight + Google Play internal testing.
- **On release tag `vX.Y.Z`:** EAS Submit → App Store + Play Store production.
- Observability: **Sentry** (errors, traces, releases w/ source maps) and **PostHog** (sign‑up → onboard → first‑task → upgrade funnels), both wired but analytics opt‑in.

---

## 13. Out of scope / non‑goals (v1)

- Microsoft Teams integration (roadmap).
- Home‑screen widgets (iOS WidgetKit / Android Glance) and iOS Live Activities — stretch, behind a flag.
- Local/on‑device LLMs — all AI is hosted Claude.
- **Visual design language is intentionally left wide open — see Creative direction at the top.** This is not a licence to ship a templated, play‑it‑safe look; it’s an invitation to invent a distinctive, original identity (palette, typography, motion, layout, voice) within the non‑negotiables listed there. Don’t wait for design specs that aren’t coming — own it.

---

## 14. Definition of done

The build is complete when:

1. A new user can sign up (email or Apple on iOS), complete onboarding, and land on a working dashboard — on **web, iOS, and Android from the same codebase**.
2. All features in §7 work with full CRUD, optimistic updates, and offline tolerance.
3. RLS provably isolates every user’s data (pgTAP passing).
4. AI chat streams with tool use and respects plan‑based model selection and rate limits.
5. Free/Pro/Family entitlements gate the correct features on both client and server; paywall and purchase/restore flows work via RevenueCat (mobile) and Stripe (web).
6. Notifications, calendar import (native + `.ics`), syllabus upload + AI breakdown, share links, recently‑deleted/restore, and GDPR export/delete all function.
7. CI is green (lint, typecheck, unit, web + mobile E2E, RLS) and the app deploys to Vercel + TestFlight + Play internal.

Build it in vertical, shippable slices: **(0)** bootstrap + auth + onboarding + schema/RLS → **(1)** subjects/tasks/deadlines/exams/papers + offline → **(2)** home/planner/streaks/themes/notifications/focus timer → **(3)** goals/portfolio/activities/syllabus + storage → **(4)** AI assistant + syllabus breakdown + daily motivation → **(5)** calendar import + share + recently deleted + GDPR → **(6)** monetization → **(7)** polish + i18n + a11y → **(8)** release. Each slice must end in a deployable, tested build.
