# Markd Rebuild — Progress log

## 2026-04-26 — initial rebuild on `rebuild` branch

**Decision:** rebuilt in place at `~/my-app/` on a fresh `rebuild` branch (per the user's
explicit OK). Backup `~/markd-app/` untouched. No remote pushes. Dropped iOS/Capacitor —
target is web-only, deployed to Vercel.

**Done**

- Phase 0 diagnosis written (`DIAGNOSIS.md`).
- Scaffolded TypeScript + Vite 8 + React 19 + Tailwind v4 + Framer Motion + Lucide + Zustand.
- Design tokens defined in `src/index.css` (warm off-white / ink, single indigo accent;
  warm charcoal dark mode). Inter for UI, Fraunces for display moments, JetBrains Mono.
- Spring motion presets in `src/lib/motion.ts`, used everywhere.
- Primitive library: `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Card`,
  `SectionHeader`, `Badge`, `Sheet`, `Tabs`, `EmptyState`, `LoadingState`, `ErrorState`.
- App shell with animated `layoutId` nav indicator, route transitions via `AnimatePresence`.
- Auth screen (sign in / sign up / guest mode) — works without Supabase keys.
- Domain logic ported: `plannerOrder`, `pickDoNext`, `nextExam`, `subjectHealth`, `totalXP`,
  `levelFromXp`. Shape of `AppData` matches the legacy JSONB blob — same Supabase schema.
- Screens: Today, Subjects, Tasks, Exams, Timer, Goals, Portfolio, Papers, Settings.
  Each has empty / loading / error coverage where it applies. Sheets used for create flows.
- README + this PROGRESS file.

**Fix list response**

1. *Layout & spacing.* Everything sits on Tailwind's 4px scale. Outer page padding
   `px-10 py-12`; cards `p-5`; row gutters `gap-3 / gap-4`. No ad-hoc margins.
2. *Animations.* Spring physics throughout — `spring.soft / snappy / hover`. View changes use
   `AnimatePresence` (`fadeUp` variant). Lists fade-up with stagger. No CSS linear easings on
   user-visible motion.
3. *Performance.* Routes are tiny; the big legacy component is gone. Memoised computations
   in `Today` and `Tasks`. Manual chunks split React, Framer, Supabase. Tasks list uses
   `AnimatePresence` exit-on-remove rather than re-rendering the whole tree.
4. *Component cohesion.* Everything composes from the primitive library. No raw shadcn
   defaults — primitives are bespoke. Icons all from Lucide.
5. *Type & colour system.* All colours are CSS vars in `:root` / `[data-theme="dark"]`. Type
   sizes come from `--text-*` tokens. No inline hex values in screens (palette swatches in
   `data/curricula.ts` is the one intentional exception, since that's data).

**Verified locally**

- `npm install` clean (68 packages).
- `npm run build` clean — 0 errors, 0 warnings on `tsc --noEmit`. Vite output:
  `index 258 kB → 76.5 kB gz · supabase 187 → 48.5 · motion 120 → 39.8 · router 27 → 9.7
  · css 35 → 6.7`. Total ~625 kB raw / ~175 kB gzipped.
- `npm run dev` boots in 210 ms; `curl localhost:5173` returns 200 with the right HTML.
- Backup `~/markd-app/`: 74 files, mtime unchanged from session start — untouched.

**Skipped, with reasoning**

- Lighthouse / screenshots: capturing them requires headless Chrome (~150 MB Playwright
  install). Deferred to keep the install footprint small. SHOWCASE/README explains the two
  paths to fill the folder.
- iOS Capacitor: dropped per user's "leave iOS" instruction. Web-only target now.

**Branch**

- `main` — original Markd, untouched.
- `rebuild` — six commits, all milestones in readable history.
- No pushes to GitHub (per user instruction).
