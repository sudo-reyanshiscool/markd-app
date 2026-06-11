-- 0002_tables.sql
-- Every table from spec §4, in FK dependency order, plus ONE documented
-- pragmatic extension: calendar_events (see bottom of file and README).
--
-- Conventions applied (documented deviations are deliberate and minimal):
--  * Primary keys are `uuid default gen_random_uuid()` except `profiles`,
--    which mirrors auth.users(id).
--  * Every user-owned table: `user_id uuid not null references auth.users(id)
--    on delete cascade` (spec §4 global rule).
--  * Timestamps are timestamptz; `created_at default now()`.
--  * Where the spec writes a column with no type, the spec's own convention is
--    text (`name`, `board`, `notes`, ...). Applied consistently, including
--    `subject_specs.year` and `papers.paper_number` (free-form values such as
--    "2024/25" or "Paper 2H" are valid). `deletion_log.entity_id` is uuid
--    (every entity PK in this schema is uuid) and `activity_events.date` is a
--    date (it mirrors deadlines.date).
--  * NOT NULL was added beyond the spec text ONLY where a NULL would be
--    semantically broken (boolean flags with defaults, counters, enum-ish
--    status columns with defaults, snapshot/payload of log/share rows). The
--    spec's nullable business fields stay nullable.
--  * `deletion_log.deleted_at` defaults to now(): it is the creation moment of
--    the log row, mirroring the created_at rule.

-- ---------------------------------------------------------------------------
-- schools (shared reference data; not user-owned)
-- ---------------------------------------------------------------------------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text,
  country     text,
  verified    boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.schools is
  'Shared school directory. User-submitted rows are forced to verified=false by trigger (0004); verification is a service-role/admin operation.';

-- ---------------------------------------------------------------------------
-- profiles (1:1 mirror of auth.users; created by handle_new_user trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null,
  name                text,
  school_id           uuid references public.schools (id) on delete set null,
  country             text,
  year_group          text,
  exam_track          text check (exam_track in ('gcse', 'igcse', 'ib', 'alevel', 'other')),
  onboarded_at        timestamptz,
  plan                text not null default 'free' check (plan in ('free', 'pro', 'family')),
  revenuecat_id       text,
  stripe_customer_id  text,
  theme               text not null default 'system' check (theme in ('system', 'light', 'dark')),
  revision_mode       boolean not null default false,
  locale              text not null default 'en',
  legacy_migrated_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column public.profiles.plan is
  'Mirror of the RevenueCat entitlement. Owner updates that change this column are rejected by trigger (0004); only service-role/webhook paths may write it.';

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create table public.subjects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  board         text,
  target_grade  text,
  color         text,
  position      integer not null default 0,   -- drag-to-reorder
  archived_at   timestamptz,                  -- soft archive (distinct from delete)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subject_specs (uploaded syllabus files; binary lives in Storage, not here)
-- ---------------------------------------------------------------------------
create table public.subject_specs (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.subjects (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  year          text,                         -- free-form ("2025", "2024/26")
  storage_path  text not null,                -- '<user_id>/<filename>' in bucket `syllabi`
  file_name     text not null,
  mime          text not null,
  size_bytes    integer not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  subject_id        uuid references public.subjects (id) on delete set null,
  text              text not null,
  done              boolean not null default false,
  priority          integer not null default 3 check (priority between 1 and 5),
  estimate_minutes  integer,
  topic             text,
  due_date          date,
  recurrence        jsonb,                    -- rrule-style, nullable
  snoozed_until     timestamptz,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- deadlines
-- ---------------------------------------------------------------------------
create table public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid references public.subjects (id) on delete set null,
  title       text not null,
  date        date not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exams
-- ---------------------------------------------------------------------------
create table public.exams (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  subject_id             uuid references public.subjects (id) on delete set null,
  name                   text not null,
  board                  text,
  date                   date not null,
  location               text,
  description            text,
  syllabus_text          text,
  syllabus_storage_path  text,
  ai_breakdown_json      jsonb,
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- papers (past-paper attempts)
-- ---------------------------------------------------------------------------
create table public.papers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  subject_id    uuid references public.subjects (id) on delete set null,
  title         text,
  year          integer,
  paper_number  text,
  scored        numeric,
  total         numeric,
  taken_on      date,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  subject_id    uuid references public.subjects (id) on delete set null,
  text          text not null,
  horizon       text check (horizon in ('3m', '6m', '9m', '12m')),
  done          boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- portfolio_entries
-- ---------------------------------------------------------------------------
create table public.portfolio_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  subject_id   uuid references public.subjects (id) on delete set null,
  title        text not null,
  type         text check (type in ('project', 'achievement', 'competition', 'leadership')),
  description  text,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- activities (extracurriculars)
-- ---------------------------------------------------------------------------
create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  role            text,
  organisation    text,
  hours_per_week  numeric,
  description     text,
  color           text,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- activity_events (dated milestones under an activity)
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  date         date,
  description  text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- topic_confidence
-- ---------------------------------------------------------------------------
create table public.topic_confidence (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  topic       text not null,
  confidence  integer check (confidence between 0 and 100),
  updated_at  timestamptz not null default now(),
  unique (user_id, subject_id, topic)
);

-- ---------------------------------------------------------------------------
-- study_sessions (focus-timer output; feeds streak/XP/weekly summary)
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  subject_id    uuid references public.subjects (id) on delete set null,
  task_id       uuid references public.tasks (id) on delete set null,
  minutes       integer not null,
  started_at    timestamptz,
  completed_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ai_conversations / ai_messages
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'tool')),
  content          text not null,
  tool_calls       jsonb,
  tokens_in        integer,
  tokens_out       integer,
  model            text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- daily_motivations (one row per user per day; spec defines no created_at —
-- `date` is the natural key and creation marker)
-- ---------------------------------------------------------------------------
create table public.daily_motivations (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  date     date not null,
  text     text not null,
  model    text,
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- calendar_feeds (.ics URL subscriptions)
-- ---------------------------------------------------------------------------
create table public.calendar_feeds (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  url               text not null,
  label             text,
  last_synced_at    timestamptz,
  last_event_count  integer,
  status            text not null default 'pending' check (status in ('ok', 'error', 'pending')),
  last_error        text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- calendar_events  ***DOCUMENTED SPEC EXTENSION — see README***
-- The spec requires imported .ics events to surface in Timeline/Deadlines and
-- to survive background sync, but defines no table to persist them. This table
-- stores the normalised events fetched by the `calendar-import` Edge Function.
-- unique (feed_id, uid) makes re-imports idempotent (ICS UID is stable).
-- ---------------------------------------------------------------------------
create table public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  feed_id      uuid not null references public.calendar_feeds (id) on delete cascade,
  uid          text not null,
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  location     text,
  description  text,
  all_day      boolean default false,
  created_at   timestamptz default now(),
  unique (feed_id, uid)
);

comment on table public.calendar_events is
  'SPEC EXTENSION (documented in supabase/README.md): persisted events imported from calendar_feeds by the calendar-import Edge Function. Owner-only RLS like every user table.';

-- ---------------------------------------------------------------------------
-- deletion_log ("recently deleted" — 30-day retention, purged by 0007 job)
-- ---------------------------------------------------------------------------
create table public.deletion_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  entity_type  text not null,            -- e.g. 'subject', 'task'
  entity_id    uuid not null,            -- PK of the deleted row (all PKs are uuid)
  snapshot     jsonb not null,           -- full row at deletion; restore re-inserts from this
  deleted_at   timestamptz not null default now(),
  restored_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- share_links (public read-only snapshots; anon access ONLY via get_share())
-- ---------------------------------------------------------------------------
create table public.share_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  slug        text not null unique,      -- short URL-safe token; unique index doubles as the lookup index
  payload     jsonb not null,            -- denormalised snapshot rendered by share/[slug]
  expires_at  timestamptz not null,
  view_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- device_tokens (Expo push)
-- ---------------------------------------------------------------------------
create table public.device_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  expo_push_token  text not null,
  platform         text check (platform in ('ios', 'android', 'web')),
  created_at       timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

-- ---------------------------------------------------------------------------
-- subscriptions (entitlement mirror written by payment webhooks; spec defines
-- no created_at — webhooks upsert and bump updated_at via trigger)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  source        text check (source in ('revenuecat', 'stripe')),
  product_id    text,
  status        text check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  period_start  timestamptz,
  period_end    timestamptz,
  raw_event     jsonb,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rate_limits (fixed-window counters; written ONLY via check_rate_limit())
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  user_id       uuid not null references auth.users (id) on delete cascade,
  key           text not null,           -- e.g. 'ai-chat', 'calendar-import'
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (user_id, key, window_start)
);
