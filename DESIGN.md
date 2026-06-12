# INK & VOLT — the Markd design language

> A sticker-bombed mission log for your school life.

Markd's interface is **warm-paper brutalism**: chunky ink borders, hard offset shadows (no blur, ever), sticker-tilted badges, and a single electric accent — **volt** — that carries every energy moment: the Do-Next card, streaks, XP, the focus timer, primary actions. It is deliberately *not* an admin dashboard. It should feel like a zine a clever student made about their own life.

## Two first-class themes

| | **Paper** (light) | **Asphalt** (dark) |
|---|---|---|
| Background | warm cream `#F6F2E9` | coal `#12110D` |
| Surface | `#FFFDF7` | `#1D1B15` |
| Ink / text | `#16140F` | bone `#F4F0E6` |
| Volt | `#C8FF1F` | `#D6FF4B` (brighter — glows, doesn't shout) |
| Shadow | ink | true black |

Asphalt is not an inversion: surfaces warm up, borders switch to bone, volt gains luminance, and the dot-grid texture fades further back. Both are tuned for WCAG-friendly contrast (ink-on-volt ≈ 13:1; muted text ≥ 4.5:1 on both backgrounds).

## Type

- **Unbounded** (700/800/900) — wordmark, screen titles, hero numerals. Wide, geometric, slightly absurd. Used sparingly so it stays loud.
- **Bricolage Grotesque** (400–700) — all reading text. Characterful grotesque that stays legible at 13px.
- **Azeret Mono** (500/700) — dates, stats, timer digits, badges. The "receipt printer" voice of the app.

## The Slab

One primitive carries the whole language: **`Slab`** — a bordered surface sitting on a hard shadow offset 4px down-right. Pressing a Slab slides it *onto* its shadow (a physical click, spring-animated, haptic on native). Cards, buttons, chips, the tab dock, the FAB, sheet panels — everything is a Slab, which is why the app feels coherent.

Supporting cast: `Stamp` (tilted sticker labels — "DO NEXT", "PRO", target grades), `Doodle` (marker-style SVG zaps/bursts/squiggles for empty states and celebrations), `DotGrid` (faint graph-paper texture behind every screen), `Reveal` (spring entrance with stagger — built on shared values so it works identically on web).

## Signature moments

- **Home** — an asymmetric mission log: huge volt Do-Next slab with a tilted ink tag, streak + level bento (last-7-days dot row, XP bar), weekly ticker strip, subject-health trading-card rail, metro-style Up Next, and the "Daily fuel" quote card in inverted ink.
- **Tab dock** — floating Slab pill; the active tab gets a volt sticker that springs in at a -4° tilt.
- **Focus timer** — full-bleed volt takeover ("LOCKED IN"), giant tabular Azeret digits, sweeping ring, celebration burst + `+25 MIN LOGGED` stamp on completion.
- **Quick-add** — typing `essay english fri 5pm 2h !` sprouts parse chips live (subject color, date, time, estimate, priority) before you ever hit enter.
- **Timeline** — a metro line: station nodes per date (volt node for today), entries as colour-railed slabs.
- **Subjects** — trading cards with a colour headband, health pips, grade stamp; long-press-drag to reorder with lift, tilt and spring drop.

## Voice

Dry hype. Short sentences. Never corporate, never patronising.

> "Nothing due. Suspicious." · "Inbox zero. Brain full." · "Streak: 4 days. Don't blink." · "Revision is just future bragging rights."

## Motion rules

Springs over easings (damping 18–24). Press = shadow-collapse. Entrances stagger 30–60ms per item via `Reveal`. Every animation checks `useReducedMotion()` and snaps to its final state when the OS asks for calm. Nothing blocks interaction; 60fps or it doesn't ship.

## Non-negotiables honoured

Clarity first (the Do-Next answer is the biggest thing on Home) · AA contrast in both themes · 44pt touch targets · screen-reader labels on every interactive element (`role`, `aria`, states) · reduced-motion respected · one design system, zero one-off screens.
