# Markd — Diagnosis (Phase 0)

Source read: original `~/my-app/` (now overwritten by the rebuild on the `rebuild` branch). Backup `~/markd-app/` left untouched.

## Stack of the original
- React 19 + Vite 8, plain JS (no TS)
- Supabase (auth + Postgres) — single `profiles` table, `app_data` JSONB
- Capacitor 8 iOS shell (dropped in the rebuild — web-only target now)
- Optional Ollama/Gemini AI via `api/ai.js`
- Optional iCal sync via `api/outlook-calendar.js`

## Data model (lives in `app_data` JSONB)
From `createEmptyAppData()` (App.jsx:370):

```
subjects[], tasks[], deadlines[], exams[], papers[], goals[],
portfolio[], activities[], deleted[], topicConfidence[], studySessions[],
theme, revisionMode, mockMode, notificationsEnabled, healthIntroSeen,
outlookCalendarUrl, calendarLastSync
```

The new app reuses the **same shape** so existing accounts roll forward without migration.

## Routes / pages (original)
Single `page` state at App.jsx:1225. Values: `home`, `subjects`, `syllabus`, `tasks`, `timeline`, `deadlines`, `exams`, `papers`, `goals`, `activities`, `portfolio`. Plus auth screens `welcome`/`signup`/`login`.

## Primary user flows
1. Sign up / sign in (Supabase email+password; legacy localStorage migration)
2. Onboard — pick curriculum, add subjects from catalogue
3. Today — Smart Daily Planner, Do Next card, Exam countdowns, Subject Health
4. Manage tasks — quick-add with auto subject/urgency/estimate
5. Track exams — countdowns + mock mode
6. Past Papers — links to AQA / Edexcel / etc.
7. Goals + Portfolio — long-horizon targets, leadership entries
8. Pomodoro sessions — XP gamification (`XP_PER_LEVEL=120`)
9. Settings — theme, calendar import, notifications

## Features carried forward
- Smart Daily Planner with priority + estimate ranking
- Do Next single-best-action card
- Exam countdowns
- Subject health score (open/overdue tasks + exam pressure)
- Pomodoro presets (25/45/60) with XP tracking
- Mock mode + revision mode toggles
- Curriculum catalogues (preload subjects)
- Past paper link directory
- Theme toggle (warm light, warm dark, system)

## Features deprioritised in v1 rebuild
- AI assistant (Ollama/Gemini) — out-of-scope until core feels right
- Outlook iCal sync — field saved, fetch endpoint deferred
- Presentation tour — replaced with genuine first-run polish
- Legacy localStorage migration — opt-in, not in main flow
- iOS Capacitor wrapper — target is web-first, deployed to Vercel

## Clanky parts (audited against the brief's fix list)
1. **Layout / spacing** — original was a 5,149-line single file with ad-hoc inline styles.
2. **Animations** — original had effectively none; modals popped, lists snapped.
3. **Performance** — one giant component re-rendered on every state change.
4. **Components** — zero primitive library; every button/card/input was bespoke.
5. **Tokens** — `index.css` had a tiny `--text/--bg/--accent` set; references to `--danger/--accent2/--accent3` weren't defined locally.

## Decisions for the rebuild
- **TypeScript strict**, `noUncheckedIndexedAccess: true`
- **Framer Motion** for spring physics + page transitions
- **Lucide** icons (one consistent set)
- **Tailwind v4** layered over CSS variables — tokens authoritative in `src/index.css`
- **Zustand** + persist + debounced Supabase write
- **React Router v6** for real URLs (`/today`, `/subjects`, …)
- **Inter + Fraunces** typography (geometric body, serif display moments)
- **Palette:** warm off-white `#FAF9F5`, ink `#14130F`, single saturated indigo accent `#3D3DF5`. Dark mode warm charcoal `#15140F`.
- **Motion:** spring presets (`stiffness ~320–520`, `damping ~30–38`); 180ms hovers, ~300ms view changes.
