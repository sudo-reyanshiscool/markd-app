# Upstream bugs found in the original `App.jsx`

Logged for reference, not fixed (per the rebuild brief — original is untouched on `main`).

1. **`getLegacyBundleForEmail` (App.jsx:456)** — passes `legacyUser.userId` to
   `readLegacyAppData`, but `legacyUser` shape only guarantees `userId` exists for accounts
   created after a certain version. Older accounts have it under `id`. Migration path silently
   no-ops for those users.

2. **`normaliseAppData` (App.jsx:391)** — `theme` is forced to `"light"` only when the input
   is the literal string `"light"`. Any other value (including `null`, `undefined`, the
   theme `"system"`) falls through to `"dark"`. Surprising default for users who explicitly
   set system.

3. **`isEmptyAppData` (App.jsx:418)** — checks `theme === "dark"` as part of the "empty"
   predicate. A new user who picked light first thing is treated as non-empty, which gates
   the onboarding banner incorrectly.

4. **Sync churn** — every state mutation pushes the entire `app_data` JSONB to Supabase with
   no debouncing. Rapid toggles can fire 5-10 writes/sec. The rebuild debounces at 600ms.

5. **`PRIORITY_META` references `var(--accent2)` / `var(--accent3)`** — these custom
   properties are never declared in `index.css`. They render as empty / inherited values.

These were *not* fixed in the rebuild source code; they were avoided by re-implementing
those code paths from scratch.
