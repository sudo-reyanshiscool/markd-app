# Markd — Supabase backend

Postgres schema, Row-Level Security, storage policies, RPC/maintenance functions,
and the pgTAP suite that proves the isolation guarantees from the spec
(`MARKD_BUILD_PROMPT.md` §4 and §10). Edge Function source lives in
`functions/` and is documented separately; this README covers the database.

```
supabase/
  config.toml      local stack config + per-function JWT verification flags
  migrations/      versioned SQL, applied in order by `supabase db reset`
  seed.sql         local-dev seed (a directory of verified schools)
  functions/       Edge Functions (Deno) — ai-chat, calendar-import, webhooks, …
  tests/           pgTAP suites, run by `supabase test db`
```

## Migrations

| File | Contents |
|---|---|
| `0001_extensions.sql` | `pgcrypto` (parity with hosted projects), plus **optional** `pg_cron` and `pg_net`. Both are created inside guarded `DO` blocks: on a stack without them the migration logs a notice and continues, and `0007` only schedules jobs when `pg_cron` is actually installed. |
| `0002_tables.sql` | Every table from spec §4 in FK-dependency order, plus the one documented extension, `calendar_events` (below). uuid PKs via `gen_random_uuid()`, `timestamptz` everywhere, `user_id … references auth.users on delete cascade` on every user-owned table. The header documents the few deliberate interpretation choices (free-form text for untyped spec columns, where `not null` was added beyond the spec text). |
| `0003_rls.sql` | RLS **enabled on all 24 tables, deny-by-default**, then explicit owner-keyed `select/insert/update/delete` policies scoped `to authenticated`. `anon` has no policy on any table. Special cases: `schools`, `profiles`, `share_links`, `subscriptions`, `rate_limits` (see "Key decisions"). Also revokes `anon`'s table grants on `share_links` outright. |
| `0004_triggers.sql` | `jwt_role()` helper; `handle_new_user` (auth.users → profiles bootstrap, email lowercased); `set_updated_at` on `profiles`, `subjects`, `ai_conversations`, `subscriptions`; `protect_profile_plan`; `force_school_unverified`. |
| `0005_indexes.sql` | The spec-minimum composites (`tasks(user_id, done, due_date)`, `deadlines(user_id, date)`, `exams(user_id, date)`, `ai_messages(conversation_id, created_at)`, `schools(domain)`), `user_id` FK indexes for every remaining table, child-by-parent lookup indexes, and the purge-scan indexes used by the nightly jobs. Indexes already provided by unique constraints are documented and not duplicated. |
| `0006_storage.sql` | Buckets `syllabi` (private) and `avatars` (public read) + the owner-prefix `storage.objects` policies. |
| `0007_functions_rpc.sql` | `get_share()`, `check_rate_limit()`, `purge_deletion_log()`, `purge_expired_share_links()` — all `SECURITY DEFINER` with pinned `search_path` — their EXECUTE grants, the `pg_cron` schedules, and a commented `pg_net` example for invoking the `daily-motivation` Edge Function on a cron. |

## `calendar_events` — documented spec extension

The spec (§7.12) requires `.ics` URL feeds to be imported by the `calendar-import`
Edge Function, to **surface in Timeline/Deadlines**, and to survive **background
sync** — but §4 defines no table to persist the imported events (only
`calendar_feeds`, which stores the subscription itself). Without persistence,
every Timeline render would need a live re-fetch of every feed, which breaks
offline-first and re-runs SSRF-sensitive network calls constantly.

`calendar_events` is therefore added as a pragmatic extension:

- normalised events written by `calendar-import` (`uid`, `title`, `starts_at`,
  `ends_at`, `location`, `description`, `all_day`);
- `unique (feed_id, uid)` makes re-imports **idempotent** (the ICS `UID` is
  stable across fetches), so background sync can blindly upsert;
- `feed_id … on delete cascade` — removing a feed removes its events;
- owner-only RLS, exactly like every other user table.

## Key decisions

### Plan protection: a trigger, not column grants

`profiles.plan` mirrors the RevenueCat/Stripe entitlement; a user who could
write it would self-upgrade for free. RLS cannot express per-column rules and
a column-level `REVOKE UPDATE` would break innocent full-row upserts from the
client even when `plan` is untouched. So `protect_profile_plan` (0004) is a
`BEFORE UPDATE` trigger that rejects only updates that **actually change**
`plan` and originate from a non-`service_role` JWT (SQLSTATE `42501`).
Requests with no JWT at all (migrations, seeds, `pg_cron`) and service-role
requests (payment webhooks) pass through. The same `jwt_role()` mechanism
powers `force_school_unverified`, which coerces user-submitted schools to
`verified = false` whatever the client sends.

### `get_share()` — the only public door into `share_links`

Public share pages (`share/[slug]`) must be readable without auth, but the
table also holds the owner's `user_id` and every other link. So:

- `anon` has **no** policy and its table grants are revoked outright (0003);
- `get_share(p_slug)` is a `SECURITY DEFINER` RPC granted to `anon` +
  `authenticated`: a single `UPDATE … RETURNING` that atomically increments
  `view_count` and returns `payload, expires_at` for a **non-expired** slug;
- expired and unknown slugs both return **zero rows** — callers cannot
  distinguish them, which avoids a slug-enumeration oracle;
- expired rows never bump `view_count` and are physically removed nightly.

### `check_rate_limit()` contract

`check_rate_limit(p_user, p_key, p_limit, p_window_seconds) → boolean` is a
fixed-window counter over `rate_limits (user_id, key, window_start)`:

- the window start is aligned to `p_window_seconds` boundaries from the epoch,
  so every call inside the same window hits the same row;
- it upsert-increments and returns **true for calls 1..limit**, false for
  every further call in the window (the counter keeps counting past the limit
  for observability); `p_limit = 0` therefore denies everything;
- zero/negative windows and negative limits raise;
- EXECUTE is granted to **service_role only** — Edge Functions call it through
  their service-role client (`supabase.rpc('check_rate_limit', …)`). Letting
  `authenticated` execute it would let anyone burn other users' quotas, since
  `p_user` is a parameter. Users can still `SELECT` their own counters.

`subscriptions` follows the same philosophy: owners can read their mirror rows
but there is **no** user write path at all — only the webhook functions
(service role) write entitlements.

### Storage path convention: `<user_id>/<filename>`

Every object key starts with the owner's uuid as the first folder segment,
e.g. `5f8a…/physics-spec-2026.pdf`. The `storage.objects` policies enforce
`(storage.foldername(name))[1] = auth.uid()::text`, so ownership is encoded in
the path itself and the client **must** follow the convention (uploads outside
your own prefix are rejected). `syllabi` is private — reads happen via signed
URLs only; `avatars` is public-read with owner-prefixed writes.
`subject_specs.storage_path` records the same path for the app's metadata.

## Running locally

Prereqs: Docker + the Supabase CLI.

```sh
supabase start      # boot the local stack (Postgres 17, API on :54321, Studio on :54323)
supabase db reset   # (re)apply migrations 0001→0007 + seed.sql
supabase test db    # run the pgTAP suites in supabase/tests/
```

Each test file is self-contained: it opens a transaction, installs pgTAP,
declares a `plan(n)`, creates its own users/fixtures as `postgres` (table
owner, exempt from RLS), impersonates end users via
`set local role authenticated` + `set local request.jwt.claims`, and rolls
back — nothing leaks between files or into your dev data.

| File | Tests | Covers |
|---|---|---|
| `01_rls_core_tables.sql` | 40 | subjects, tasks, deadlines, exams, papers |
| `02_rls_children_tables.sql` | 56 | goals, portfolio_entries, activities, activity_events, topic_confidence, study_sessions, subject_specs |
| `03_rls_ai_calendar_system_tables.sql` | 74 | ai_conversations, ai_messages, daily_motivations, calendar_feeds, calendar_events, share_links, deletion_log, device_tokens + the read-only `subscriptions` / `rate_limits` mirrors |
| `04_rls_special_cases.sql` | 32 | schools (shared read, forced-unverified inserts, no user writes), profiles (plan-change guard, no cross-read, no delete), storage.objects bucket policies (owner prefixes, public avatars, anon) |
| `05_functions.sql` | 29 | handle_new_user, check_rate_limit (window/limit/grants), get_share (live/expired/unknown, view_count, anon grants), purge_deletion_log, purge_expired_share_links |

Total: **231 assertions.** The cross-tenant pattern everywhere: spoofed
INSERTs fail with SQLSTATE `42501`; cross-tenant UPDATE/DELETE are proven
impossible via `… returning` coming back empty (RLS filters the target rows
before the statement touches anything).

## Scheduled jobs

`0007` schedules two nightly maintenance jobs with `pg_cron`, guarded so the
migration still applies on stacks without the extension (it checks
`pg_extension` at runtime; `cron.schedule` by name is idempotent on re-runs):

| Job | Schedule (UTC) | Runs |
|---|---|---|
| `markd-purge-deletion-log` | `15 3 * * *` | `purge_deletion_log()` — deletes "recently deleted" entries older than 30 days (spec §7.16) |
| `markd-purge-expired-share-links` | `30 3 * * *` | `purge_expired_share_links()` — drops share links past `expires_at` |

If `pg_cron` is unavailable, run both functions from an external scheduler
(e.g. a scheduled Edge Function or CI cron) using a **service-role** client —
EXECUTE on both is service-role only.

For the nightly `daily-motivation` Edge Function (spec §8.3), `0007` ships a
**commented** `pg_cron` + `pg_net` example that POSTs to
`/functions/v1/daily-motivation` with a service-role bearer token. It is
commented out because it needs per-project secrets; to enable it, store the
project URL and service-role key outside source control first (Supabase Vault
or database settings, as shown in the migration comment) and uncomment the
block. Alternatively, use the Supabase Dashboard's cron scheduling for the
function. Note that the webhooks (`stripe-webhook`, `revenuecat-webhook`) are
the only functions with `verify_jwt = false` in `config.toml` — they
authenticate via their providers' signatures instead.

## Hardening notes (known, deliberate trade-offs)

- **Child-row inserts validate `user_id` only.** Per spec §4, all policies are
  keyed on `auth.uid() = user_id`, so an authenticated user could insert one of
  *their own* rows referencing *another user's* parent (e.g. an `ai_message`
  pointing at someone else's conversation) if they somehow learned its uuid.
  Nothing leaks — the other user never sees the row and no data is returned —
  but a stricter build could add `exists (select 1 from parent where id = … and
  user_id = auth.uid())` to child insert policies.
- **`daily_motivations` is owner-writable.** The daily-motivation function
  (service role) is the intended writer, but owner CRUD is allowed like other
  tables; worst case a user edits their own motivational line.
- **`schools` name search** uses `ilike '%term%'`, which the btree `domain`
  index cannot serve; a `pg_trgm` index is a possible future optimisation
  (noted in 0005).
