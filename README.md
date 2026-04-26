# Markd

A calmer student organiser for GCSE, A-Level and IB. Web-first; deploys to Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local      # optional — leave empty for guest mode
npm run dev
```

Open [localhost:5173](http://localhost:5173).

Without Supabase keys, Markd runs as a guest: data lives in `localStorage` only. Add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable accounts and cross-device sync.

## Build

```bash
npm run build      # tsc -b && vite build
npm run preview    # serve the build at :4173
```

## Deploy to Vercel

Push the repo. Vercel auto-detects Vite. Add the two env vars in the project settings; nothing
else to configure.

## Stack

- **React 19 + Vite 8 + TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS v4** for utility styling — design tokens come from `src/index.css`
- **Framer Motion** for spring micro-interactions and view transitions
- **Lucide** icons (one set, used everywhere)
- **Zustand** + `persist` for app state, with a debounced Supabase write layer
- **Supabase** auth + a single `profiles.app_data` JSONB row per user (compatible with the legacy schema)

## Design tokens

A single source of truth in `src/index.css`:

| Token group | What's there |
|---|---|
| Colour | `--bg`, `--surface`, `--surface-2/3`, `--ink`, `--ink-2/3/4`, `--line`, `--line-strong`, `--accent`, `--accent-soft`, `--accent-ink`, `--warmth`, `--danger`, `--success` |
| Type | `--font-sans` (Inter), `--font-display` (Fraunces), `--font-mono` (JetBrains Mono); `--text-2xs … --text-3xl` scale |
| Spacing | 4px base, applied via Tailwind utilities (`p-5`, `gap-3`, etc.) |
| Radius | `--radius-xs … --radius-xl` |
| Motion | `spring.soft / snappy / hover` in `src/lib/motion.ts`; CSS easing tokens `--ease-out-smooth`, `--ease-spring` |

Dark mode is a warm charcoal, not pure black. Light mode is warm off-white over deep ink.

## Folder map

```
src/
  App.tsx                # router root + auth gate
  main.tsx               # React root + ThemeProvider
  index.css              # design tokens + Tailwind import
  lib/
    types.ts             # AppData / Subject / Task / Exam / Goal / …
    store.ts             # zustand + persist + debounced Supabase sync
    domain.ts            # plannerOrder · pickDoNext · subjectHealth · XP
    format.ts            # date and duration formatters
    motion.ts            # shared spring presets
    theme.tsx            # light/dark/system context
    supabase.ts          # client (null when keys missing)
  data/
    curricula.ts         # GCSE / A-Level / IB / IGCSE catalogues + paper links
  components/
    ui/                  # Button, Input, Select, Card, Badge, Sheet, Tabs, EmptyState, States
    layout/AppShell.tsx  # sidebar nav + animated route container
  screens/               # one file per route
```

## Acceptance notes

See `PROGRESS.md` for the rebuild log and `DIAGNOSIS.md` for what was extracted from the
previous build.
