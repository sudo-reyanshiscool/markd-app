# Markd Edge Functions — Setup & API Contracts

Nine Deno Edge Functions plus shared helpers in `_shared/`. Everything below documents the
code **as implemented** — wire clients against this, not the spec.

| Function | Purpose | JWT gate |
|---|---|---|
| `ai-chat` | Streaming study-assistant chat (SSE, server-side tools) | platform `verify_jwt = true` + in-code user check |
| `ai-syllabus-breakdown` | Syllabus PDF/text → structured topic tree (Pro) | same |
| `daily-motivation` | Nightly one-liner per active user (cron) or on-demand (user) | same (cron callers send the service-role key as Bearer) |
| `calendar-import` | Add/re-sync an `.ics` feed (Pro, SSRF-hardened) | same |
| `share-create` | Create/revoke the public share-link snapshot | same |
| `data-export` | GDPR zip of all user rows + uploaded files | same |
| `account-delete` | GDPR account deletion (storage purge + auth delete) | same |
| `stripe-webhook` | Stripe webhook + checkout/billing-portal endpoints | **`verify_jwt = false`** — signature / in-code JWT |
| `revenuecat-webhook` | RevenueCat server-to-server webhook | **`verify_jwt = false`** — static auth header |

---

## 1. Environment variables / secrets

Every variable actually read by the functions (`grep -rn "Deno.env.get\|requiredEnv" supabase/functions`):

| Variable | Required | Read by | Purpose | Example value format |
|---|---|---|---|---|
| `SUPABASE_URL` | auto-injected | all (`_shared/auth.ts`) | Project API URL for both clients | `https://abcdefghijkl.supabase.co` |
| `SUPABASE_ANON_KEY` | auto-injected | all (`_shared/auth.ts`) | Anon key for the **user-scoped** client (RLS applies) | `eyJhbGciOiJIUzI1NiIs…` |
| `SUPABASE_SERVICE_ROLE_KEY` | auto-injected | all (`_shared/auth.ts`) | Service-role client (rate-limit RPC, webhooks, storage admin) | `eyJhbGciOiJIUzI1NiIs…` |
| `ANTHROPIC_API_KEY` | **yes** | `ai-chat`, `ai-syllabus-breakdown`, `daily-motivation` (via `_shared/anthropic.ts`) | Anthropic Messages API key | `sk-ant-api03-…` |
| `ANTHROPIC_MODEL_SONNET` | no (default `claude-sonnet-4-6`) | same | Model id for pro/family plans | `claude-sonnet-4-6` |
| `ANTHROPIC_MODEL_HAIKU` | no (default `claude-haiku-4-5`) | same | Model id for the free plan | `claude-haiku-4-5` |
| `CRON_SECRET` | yes (for the nightly batch) | `daily-motivation` | Value the scheduler must send in `x-cron-secret` to unlock batch mode | 32+ chars of randomness, e.g. `openssl rand -hex 24` |
| `APP_WEB_URL` | **yes** for Stripe checkout; recommended always | `stripe-webhook`, `share-create` | Base URL for checkout success/cancel redirects and share-link URLs (no trailing slash) | `https://markd.app` |
| `STRIPE_SECRET_KEY` | yes (web billing) | `stripe-webhook` | Stripe API key (REST calls, no SDK) | `sk_live_…` / `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | yes (web billing) | `stripe-webhook` | Signing secret of the webhook endpoint | `whsec_…` |
| `STRIPE_PRICE_PRO_MONTHLY` | yes (web billing) | `stripe-webhook` | Price id mapped to plan `pro` | `price_1Nxxxx…` |
| `STRIPE_PRICE_PRO_YEARLY` | yes (web billing) | `stripe-webhook` | Price id mapped to plan `pro` | `price_1Nyyyy…` |
| `STRIPE_PRICE_FAMILY_YEARLY` | yes (web billing) | `stripe-webhook` | Price id mapped to plan `family` | `price_1Nzzzz…` |
| `REVENUECAT_API_KEY` | optional | `stripe-webhook` | RevenueCat **Stripe app public API key**; when set, entitled Stripe subs are mirrored into RC via `POST /v1/receipts` (best-effort) | `strp_…` |
| `RC_WEBHOOK_AUTH` | yes (mobile billing) | `revenuecat-webhook` | The **exact, full** `Authorization` header value RevenueCat is configured to send (compared verbatim, constant-time) | `Bearer 9f2c…long-random…` |

Notes:
- The three `SUPABASE_*` variables are injected by the platform automatically (locally by
  `supabase functions serve`). You cannot set `SUPABASE_`-prefixed secrets yourself.
- Set everything else with:

```sh
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-api03-... \
  CRON_SECRET=$(openssl rand -hex 24) \
  APP_WEB_URL=https://markd.app \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_PRO_MONTHLY=price_... \
  STRIPE_PRICE_PRO_YEARLY=price_... \
  STRIPE_PRICE_FAMILY_YEARLY=price_... \
  REVENUECAT_API_KEY=strp_... \
  RC_WEBHOOK_AUTH='Bearer <random>'
```

For local serving, put the same keys in `supabase/functions/.env` (git-ignored) and run
`supabase functions serve --env-file supabase/functions/.env`.

---

## 2. Deploy

```sh
supabase functions deploy ai-chat
supabase functions deploy ai-syllabus-breakdown
supabase functions deploy daily-motivation
supabase functions deploy calendar-import
supabase functions deploy share-create
supabase functions deploy data-export
supabase functions deploy account-delete

# Webhooks: platform JWT verification OFF
supabase functions deploy stripe-webhook     --no-verify-jwt
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

`supabase/config.toml` already pins the same policy (`[functions.<name>] verify_jwt = …`),
which recent CLI versions honour on deploy; the `--no-verify-jwt` flags make it explicit.

**Why the two webhooks have `verify_jwt = false`:** Stripe and RevenueCat servers cannot
mint Supabase JWTs, so the platform gate must be off. Each request authenticates itself
inside the function instead:

- `stripe-webhook` POST — `Stripe-Signature` header verified with HMAC-SHA256 against
  `STRIPE_WEBHOOK_SECRET` (v1 scheme, 5-minute timestamp tolerance, constant-time compare).
  Unsigned/expired requests get `400 invalid_signature` before any work happens.
- `stripe-webhook` GET (`create-checkout`, `billing-portal`) — although the platform gate is
  off, these paths call `requireUser()` in code and 401 without a valid user JWT.
- `revenuecat-webhook` — the raw `Authorization` header must equal `RC_WEBHOOK_AUTH` exactly
  (constant-time compare), otherwise `401 unauthorized`.

Every other function keeps `verify_jwt = true` **and** re-validates the user in code
(`requireUser`), running all user data access through a user-scoped client so RLS applies.

---

## 3. Scheduling `daily-motivation`

The nightly batch needs **two** headers, because the function keeps `verify_jwt = true`:

| Header | Value | Why |
|---|---|---|
| `Authorization` | `Bearer <SUPABASE_SERVICE_ROLE_KEY>` | passes the platform JWT gate |
| `x-cron-secret` | `<CRON_SECRET>` | switches the function into batch mode |

If `x-cron-secret` is present but wrong (or `CRON_SECRET` is unset), the response is
`403 forbidden`. If the header is absent, the request is treated as a normal user request.

pg_cron + pg_net (store the URL/key outside source control, e.g. Vault or DB settings —
see the commented example at the bottom of `supabase/migrations/0007_functions_rpc.sql`,
**adding the `x-cron-secret` header as below**):

```sql
select cron.schedule(
  'markd-daily-motivation',
  '0 2 * * *',                                  -- 02:00 UTC nightly
  $$
  select net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/daily-motivation',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Any external scheduler (GitHub Actions cron, Cloud Scheduler, …) works the same way:
`POST https://<ref>.supabase.co/functions/v1/daily-motivation` with those two headers.

The DB-side purge jobs (`purge_deletion_log`, `purge_expired_share_links`) are scheduled
directly in `0007_functions_rpc.sql` when pg_cron is installed — nothing to do here.

---

## 4. Shared API conventions

- **Base URL:** `https://<project-ref>.supabase.co/functions/v1/<name>`
- **Auth (user functions):** `Authorization: Bearer <supabase access token>` (plus the usual
  `apikey: <anon key>` header when calling the platform directly). `supabase.functions.invoke`
  sets both — but for `ai-chat` use raw `fetch` so you can consume the SSE stream.
- **Errors (every function, every status):**
  ```json
  { "error": { "code": "<machine_code>", "message": "<human readable>" } }
  ```
  Common codes: `unauthorized` (401), `invalid_request` (400), `method_not_allowed` (405),
  `not_found` (404), `pro_required` (403), `rate_limited` (429, with `Retry-After` seconds),
  `rate_limit_unavailable` (503, with `Retry-After: 30` — limiter RPC down, fails closed),
  `internal_error` (500).
- **Rate limits** (fixed window via `public.check_rate_limit`, counted per user):

  | Key | Window | Limit | Function |
  |---|---|---|---|
  | `ai-chat` | 60 s | 20 | ai-chat |
  | `ai-breakdown` | 1 h | 5 | ai-syllabus-breakdown |
  | `daily-motivation` | 1 h | 6 | daily-motivation (user mode) |
  | `calendar-import` | 1 h | 6 | calendar-import |
  | `share-create` | 1 h | 10 | share-create (POST and DELETE) |
  | `data-export` | 24 h | 2 | data-export |
  | `stripe-checkout` | 1 h | 10 | stripe-webhook GET create-checkout |
  | `stripe-portal` | 1 h | 10 | stripe-webhook GET billing-portal |

- **Plan gating:** `profiles.plan` is read server-side per request. `free` → Haiku model,
  50 AI messages/month, no Pro features. `pro` and `family` → Sonnet model, 2000 AI
  messages/month, Pro features unlocked.
- CORS is `*` with `OPTIONS` preflight handled by every function
  (`authorization, x-client-info, apikey, content-type, x-cron-secret, stripe-signature` allowed).

---

## 5. Per-function contracts (as implemented)

### 5.1 `ai-chat` — POST

Request body:

```json
{ "conversation_id": "<uuid, optional>", "message": "<1..4000 chars, required>" }
```

- **Omit** `conversation_id` (do not send `null`) to start a new conversation — the function
  creates one titled with the first ~60 chars of the message. An explicit `null` is rejected
  with `400 invalid_request`.
- Pipeline: JWT → monthly quota → burst rate limit → conversation create/verify → last 30
  user/assistant messages as history → 3 system blocks (static + per-user, both with
  `cache_control: ephemeral`; live snapshot uncached) → streaming Claude call with 6 tools,
  executed server-side against the **user-scoped** client (RLS), up to 6 tool rounds →
  both messages persisted (`ai_messages`), conversation `updated_at` bumped.
- Tools the model may call: `get_subjects`, `get_upcoming_deadlines`, `get_topic_confidence`,
  `add_task`, `mark_done`, `log_study_session`.

Non-stream errors (JSON, before the stream starts): `400 invalid_request`,
`401 unauthorized`, **`402 quota_exceeded`** (monthly cap: count of `role = "user"` rows in
`ai_messages` this UTC calendar month — 50 free / 2000 pro+family), `404 not_found`
(conversation id not yours/doesn't exist), `429 rate_limited`, `500 internal_error`,
`503 rate_limit_unavailable`.

Success: `200` with `Content-Type: text/event-stream; charset=utf-8`. **SSE frame format**
(one event per frame, exactly `event:` line + `data:` line + blank line):

```
event: <name>
data: <JSON>

```

Events, in order:

1. `delta` — zero or more, incremental assistant text:
   `data: {"text":"<chunk>"}`
2. `tool` — two per tool invocation, possibly interleaved between delta runs
   (the model can emit text → tools → more text across rounds):
   `data: {"name":"add_task","status":"running"}` then
   `data: {"name":"add_task","status":"ok"}` (or `"status":"error"`)
3. Exactly one terminal event:
   - `done` — `data: {"conversation_id":"<uuid>","message_id":"<uuid|null>","tokens_in":1234,"tokens_out":256,"model":"claude-sonnet-4-6"}`
     (`message_id` is `null` only if persisting the assistant row failed; `tokens_in`
     includes cache-creation and cache-read tokens), **or**
   - `error` — `data: {"message":"<safe human-readable string>"}` (upstream AI failure or
     internal stream error; the user message was already persisted).

Then the stream closes. Treat `done`/`error` as terminal; also handle an unexpected socket
close (e.g. network drop) as an error. Example session:

```
event: delta
data: {"text":"Let me check your week."}

event: tool
data: {"name":"get_upcoming_deadlines","status":"running"}

event: tool
data: {"name":"get_upcoming_deadlines","status":"ok"}

event: delta
data: {"text":"You have 3 deadlines before Friday…"}

event: done
data: {"conversation_id":"8b6d…","message_id":"f04a…","tokens_in":2480,"tokens_out":190,"model":"claude-haiku-4-5"}
```

### 5.2 `ai-syllabus-breakdown` — POST (Pro)

Request body — exactly one of:

```json
{ "exam_id": "<uuid>" }      // exams.syllabus_text, else exams.syllabus_storage_path
{ "spec_id": "<uuid>" }      // subject_specs.storage_path (+ stored mime hint)
```

(If both are sent, `exam_id` wins.) Files are downloaded from the private `syllabi` bucket
via the service role after a user-scoped row read proves ownership. PDFs are extracted with
`pdfjs-dist` (≤ 80 pages, ≤ 150k chars); anything else is decoded as UTF-8 text.

Success `200` (also persisted to `exams.ai_breakdown_json` when called with `exam_id`;
persist failure is logged and non-fatal — the body is still returned):

```json
{
  "topics": [
    {
      "name": "Quantitative chemistry",
      "subtopics": ["Moles", "Limiting reagents"],
      "key_skills": ["balance redox equations"],
      "estimated_hours": 6.5
    }
  ]
}
```

(Single-shot Sonnet call, forced through a `submit_breakdown` tool; output is validated and
clamped server-side — ≤ 60 topics, ≤ 40 subtopics/key_skills each, hours 0–500.)

Errors: `400 invalid_request`, `401`, `403 pro_required`, `404 not_found` (exam/spec row or
storage object), `422 no_syllabus` (exam has neither text nor file), `422 extraction_failed`
(scanned/unreadable PDF or < 40 usable chars), `429`, `502 ai_unavailable`,
`502 ai_invalid_output`, `500 internal_error`.

### 5.3 `daily-motivation` — POST (two modes)

**Cron batch** (headers per §3; body ignored): generates one line for every user with
activity in the last 14 days (completed task, study session, or AI message), skipping users
who already have today's row. Concurrency-capped at 5 users in flight. Response `200`:

```json
{ "date": "2026-06-12", "active_users": 412, "generated": 268, "skipped": 140, "failed": 4 }
```

Wrong/unset secret → `403 forbidden`. Note: **any** request carrying an `x-cron-secret`
header is routed to cron mode, even if it also has a valid user JWT.

**User mode** (normal JWT, no `x-cron-secret`): generates today's line for the caller if
missing, otherwise returns the existing one. Response `200`:

```json
{ "motivation": { "date": "2026-06-12", "text": "Day 9 of your streak — Chemistry won't revise itself.", "model": "claude-haiku-4-5" }, "generated": true }
```

Errors: `401`, `429`, `502 ai_unavailable` (generation failed). Lines are ≤ 140 chars,
upserted into `daily_motivations` on `(user_id, date)` with duplicates ignored.

### 5.4 `calendar-import` — POST (Pro)

Request body — one of:

```json
{ "url": "https://example.com/feed.ics", "label": "School calendar" }   // create + first sync
{ "feed_id": "<uuid>" }                                                 // re-sync existing feed
```

`label` optional, trimmed to 80 chars; `url` ≤ 2048 chars. URL rules (re-checked on every
re-sync): `https://` only, no embedded credentials, port 443 only, hostname not
localhost/`.local`/`.internal`/`.home.arpa`, IP literals and **all** resolved A/AAAA records
must be public (blocks RFC1918, loopback, link-local, CGNAT, multicast/reserved, `fc00::/7`,
`fe80::/10`, `::1`, `::`, IPv4-mapped IPv6). Fetch: no redirects, 10 s timeout, 5 MB
streaming cap. Parsing: tolerant ICS (folded lines, quoted params, DATE vs DATE-TIME,
TZID/floating times treated as UTC), first occurrence per UID, ≤ 2000 events.

Success `200` (events upserted on `(feed_id, uid)`, disappeared UIDs deleted, feed row
updated to `status: "ok"`):

```json
{
  "feed": { "id": "<uuid>", "status": "ok", "last_synced_at": "2026-06-12T08:00:00.000Z", "last_event_count": 57 },
  "imported": 57,
  "deleted": 3
}
```

Errors: `400 invalid_request` / `400 url_not_allowed` (message says why; feed marked
`status:"error"` when it already exists), `401`, `403 pro_required`, `404 not_found`,
`422 sync_failed` (download/parse/save failure — `calendar_feeds.last_error` records the
reason), `429`, `500`.

### 5.5 `share-create` — POST / DELETE

**POST** (Pro; body ignored): replaces any existing link (a user has at most one), inserts a
denormalised snapshot with `expires_at = now() + 30 days`. Success `201`:

```json
{ "slug": "Xy3_kP9q-A", "url": "https://markd.app/share/Xy3_kP9q-A", "expires_at": "2026-07-12T08:00:00.000Z" }
```

Snapshot payload stored in `share_links.payload` (rendered by the public `share/[slug]`
page, which resolves slugs via the anon-executable `get_share(p_slug)` RPC — that RPC also
increments `view_count` and returns nothing for expired/unknown slugs):

```json
{
  "first_name": "Reyansh",
  "subjects": [{ "name": "Chemistry", "target_grade": "9" }],
  "streak_days": 9,
  "level": 4,
  "xp": 1520,
  "upcoming": [{ "title": "Paper 2", "date": "2026-06-18", "kind": "exam" }],
  "week": { "tasks_done": 11, "study_minutes": 340 }
}
```

(XP = 10 × completed tasks + 1 × study minute; level = `floor(sqrt(xp/100)) + 1`;
`upcoming` = next 5 deadlines+exams by date; `week` = since Monday 00:00 UTC.)

**DELETE** (any plan, so downgraded users can revoke): body `{ "slug": "<string ≤ 64>" }` →
`204 No Content`, or `404 not_found` (no such slug owned by you), `400 invalid_request`.

POST errors: `401`, `403 pro_required`, `429`, `500 internal_error`.

### 5.6 `data-export` — POST

No body. Success `200` with `Content-Type: application/zip` and
`Content-Disposition: attachment; filename="markd-export-YYYY-MM-DD.zip"`:

```
markd-export-2026-06-12.zip
├── data.json            # { export: { app, version: 1, user_id, exported_at, notes[] },
│                        #   data: { profile, subjects: [...], tasks: [...], ... } }
└── files/<file_name>    # every object under syllabi/<user_id>/
```

`data` contains `profile` (single object) plus arrays for: subjects, subject_specs, tasks,
deadlines, exams, papers, goals, portfolio_entries, activities, activity_events,
topic_confidence, study_sessions, ai_conversations, ai_messages, daily_motivations,
calendar_feeds, calendar_events, deletion_log, share_links, device_tokens, subscriptions.
All rows are fetched via the user-scoped client (RLS), paged 1000 at a time, ≤ 20k
rows/table (truncations and per-table failures are listed in `export.notes`).

Errors: `401`, `413 export_too_large` (> 50 MB including files), `429` (2/day), `500`.

### 5.7 `account-delete` — POST

Request body must be exactly:

```json
{ "confirm": "DELETE" }
```

Deletes every storage object under `<user_id>/` in the `syllabi` and `avatars` buckets
(best-effort; storage hiccups don't block deletion), then `auth.admin.deleteUser(user_id)` —
all user rows cascade via FKs to `auth.users`. Success: `204 No Content`.
Errors: `400 confirmation_required`, `401`, `500 internal_error`.

### 5.8 `stripe-webhook` — POST (Stripe) / GET (app)

**POST** — Stripe events (signature-verified, see §2). Handled types:

- `checkout.session.completed` — resolves the user from `client_reference_id` →
  `metadata.supabase_user_id` → `profiles.stripe_customer_id` lookup; saves
  `stripe_customer_id`; for subscription-mode sessions fetches the subscription from the
  Stripe API and applies it (the session object itself has no price/period info).
- `customer.subscription.updated` — resolves user from `metadata.supabase_user_id` →
  customer-id lookup; applies status/price.
- `customer.subscription.deleted` — same, but status forced to `canceled`.

"Applying" = upsert `subscriptions` (`source: "stripe"`, `product_id` = price id, mapped
`status`, period start/end, `raw_event`) + set `profiles.plan`. Status map:
`active→active`, `trialing→trialing`, `past_due|unpaid|incomplete→past_due` (plan kept —
grace period), `canceled→canceled`, anything else → `expired`; `canceled`/`expired` set
plan `free`. Plan from price id: `STRIPE_PRICE_FAMILY_YEARLY → family`,
`STRIPE_PRICE_PRO_MONTHLY|STRIPE_PRICE_PRO_YEARLY → pro`, unknown-but-entitled → `pro`.
When `REVENUECAT_API_KEY` is set and the sub is entitled, the purchase is forwarded to
RevenueCat (`POST /v1/receipts`, `X-Platform: stripe`, `fetch_token` = subscription id,
`app_user_id` = Supabase user id) — best-effort, failures logged and ignored.

Responses: `200 {"received":true}` (including unhandled event types and events whose user
can't be resolved — retrying wouldn't help), `400 invalid_signature` / `invalid_request`,
`500 misconfigured` (no `STRIPE_WEBHOOK_SECRET`) / `processing_failed` (transient — Stripe
retries non-2xx).

**GET `?action=create-checkout&price=pro_monthly|pro_yearly|family_yearly`** (user JWT
required): creates a Checkout Session — `mode=subscription`, the mapped price env id,
`client_reference_id` = Supabase user id, `metadata.supabase_user_id` and
`subscription_data.metadata.supabase_user_id` = user id, 7-day trial
(`subscription_data.trial_period_days=7`), `allow_promotion_codes=true` (educational
discounts), existing `profiles.stripe_customer_id` reused as `customer` else
`customer_email`; `success_url` = `${APP_WEB_URL}/paywall?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
`cancel_url` = `${APP_WEB_URL}/paywall?checkout=cancelled`.
Success `200 { "url": "https://checkout.stripe.com/c/pay/cs_..." }`.
Errors: `400 invalid_request` (bad/missing `price`), `401`, `429`, `500 misconfigured`
(price id or `APP_WEB_URL` unset), `502 stripe_unavailable`.

**GET `?action=billing-portal`** (user JWT required): `200 { "url": ... }`, or
`400 no_billing_account` if the profile has no `stripe_customer_id` yet, `401`, `429`,
`502 stripe_unavailable`.

Any other GET `action` → `400 invalid_request`; other methods → `405`.

### 5.9 `revenuecat-webhook` — POST

Auth: raw `Authorization` header must equal `RC_WEBHOOK_AUTH` byte-for-byte (§2).
Body: RevenueCat v1 shape `{ "event": { ... } }` → `400 invalid_request` when missing.

The Supabase user id is taken from the first UUID among `event.app_user_id`,
`event.original_app_user_id`, `event.aliases[]` (the app must log into RevenueCat with the
Supabase uid as the app user id). If none is a UUID → `200 {"received":true,"skipped":"unresolvable_user"}`.

| Event type | `subscriptions.status` | `profiles.plan` |
|---|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE` | `trialing` if `period_type == "TRIAL"` else `active` | from `entitlement_ids`: any id containing `family` → `family`, else `pro` (also `pro` when the list is empty) |
| `CANCELLATION` | `canceled` | **unchanged** (access runs until expiry) |
| `BILLING_ISSUE` | `past_due` | **unchanged** (grace period) |
| `EXPIRATION` | `expired` | `free` |
| anything else (`TRANSFER`, `TEST`, `UNCANCELLATION`, …) | — | — → `200 {"received":true,"skipped":"unhandled_type"}` |

Also writes `subscriptions.product_id` (= `event.product_id`), `period_start`/`period_end`
(from `purchased_at_ms`/`expiration_at_ms`), `raw_event` (full body), and
`profiles.revenuecat_id`. Success `200 {"received":true}`; persistence failure →
`500 processing_failed` (RevenueCat retries).

---

## 6. Stripe setup checklist

1. Create the products/prices (Pro monthly £3.99, Pro yearly £29, Family yearly £49) and put
   the three `price_…` ids into `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`,
   `STRIPE_PRICE_FAMILY_YEARLY`. Plan mapping happens **only** through these env vars — a
   renamed/extra price will fall back to `pro` for entitled subs.
2. Add a webhook endpoint: `https://<ref>.supabase.co/functions/v1/stripe-webhook`,
   subscribed to `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Checkout from the client: `GET /functions/v1/stripe-webhook?action=create-checkout&price=pro_monthly`
   with the user's JWT, then open the returned `url`. `client_reference_id` is set to the
   Supabase user id automatically — never construct checkout sessions client-side.
4. Enable the customer Billing Portal in the Stripe dashboard (the `billing-portal` action
   just creates sessions for it).
5. Promotion codes are allowed at checkout (`allow_promotion_codes=true`) — create the 15%
   educational coupon/promo codes in Stripe if you want that flow.
6. API-version note: the handler reads `current_period_start/end` from the **subscription
   top level**. On Stripe API versions ≥ 2025-03-31 those moved to subscription items, in
   which case the period columns are stored as `null` (everything else still works). Pin the
   webhook endpoint to an earlier API version if you want period dates populated.

## 7. RevenueCat setup checklist

1. The app must call `Purchases.logIn(<supabase user id>)` so `app_user_id` is the Supabase
   uid — that is the only way webhook events resolve to a user.
2. Dashboard → Project → Integrations → **Webhooks**: URL
   `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`, and set the *Authorization
   header value* to a long random string. Put **the exact same full string** into
   `RC_WEBHOOK_AUTH` (if you type `Bearer xyz` there, the secret is `Bearer xyz`).
3. Entitlement identifiers should be `pro` and `family` (matching is substring-based and
   case-insensitive; any entitlement containing "family" → family plan).
4. Optional web→mobile mirroring: set `REVENUECAT_API_KEY` to the RC **Stripe app public
   API key** (`strp_…`) so Stripe purchases appear in RevenueCat too.

---

## 8. Local development

```sh
supabase start
supabase functions serve --env-file supabase/functions/.env
# then e.g.
curl -N http://127.0.0.1:54321/functions/v1/ai-chat \
  -H "Authorization: Bearer <user jwt>" -H "Content-Type: application/json" \
  -d '{"message":"What should I revise today?"}'
```

`config.toml` already carries the per-function `verify_jwt` settings for local serving.

## 9. Known caveats (intentional, documented for the client team)

- `ai-chat`: send **no** `conversation_id` key to start a conversation; `null` is a 400.
- PostgREST `max_rows` (1000/page) softly caps the streak/XP scans (`share-create`,
  `daily-motivation`) and the per-page export reads — heavy accounts may see slightly
  conservative streak/XP numbers; `data-export` pages correctly and is unaffected.
- `daily-motivation` cron mode requires both headers (§3); the commented pg_cron example in
  `0007_functions_rpc.sql` predates the `x-cron-secret` requirement — use the §3 snippet.
- `revenuecat-webhook` acks `UNCANCELLATION` without changes; state self-corrects on the
  next `RENEWAL`/`EXPIRATION`.
- `data-export` responses don't expose `Content-Disposition` to cross-origin JS (no
  `Access-Control-Expose-Headers`); web clients should name the file themselves.
