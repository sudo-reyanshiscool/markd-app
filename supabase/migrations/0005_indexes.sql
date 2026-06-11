-- 0005_indexes.sql
-- Spec §4 "Indexes (minimum)" + requirement list, with notes where an existing
-- constraint already provides the index.
--
-- Already covered, NOT duplicated here:
--  * share_links(slug)                       — UNIQUE constraint in 0002
--  * daily_motivations(user_id, ...)         — UNIQUE (user_id, date)
--  * device_tokens(user_id, ...)             — UNIQUE (user_id, expo_push_token)
--  * topic_confidence(user_id, ...)          — UNIQUE (user_id, subject_id, topic)
--  * rate_limits(user_id, ...)               — PRIMARY KEY (user_id, key, window_start)
--  * calendar_events(feed_id, ...)           — UNIQUE (feed_id, uid)
--  * profiles(id)                            — PRIMARY KEY
-- For tasks/deadlines/exams/calendar_events the required composite below leads
-- with user_id, so it also serves as the user_id FK index.

-- Required composites ---------------------------------------------------------
create index if not exists tasks_user_done_due_idx
  on public.tasks (user_id, done, due_date);

create index if not exists deadlines_user_date_idx
  on public.deadlines (user_id, date);

create index if not exists exams_user_date_idx
  on public.exams (user_id, date);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at);

create index if not exists calendar_events_user_starts_idx
  on public.calendar_events (user_id, starts_at);

create index if not exists schools_domain_idx
  on public.schools (domain);
-- (schools name search uses ilike '%term%', which btree cannot serve; a
-- pg_trgm index is a possible future optimisation, deliberately not added.)

-- user_id FK indexes (tables without a leading-user_id index above) ----------
create index if not exists subjects_user_id_idx           on public.subjects (user_id);
create index if not exists subject_specs_user_id_idx      on public.subject_specs (user_id);
create index if not exists papers_user_id_idx             on public.papers (user_id);
create index if not exists goals_user_id_idx              on public.goals (user_id);
create index if not exists portfolio_entries_user_id_idx  on public.portfolio_entries (user_id);
create index if not exists activities_user_id_idx         on public.activities (user_id);
create index if not exists activity_events_user_id_idx    on public.activity_events (user_id);
create index if not exists study_sessions_user_id_idx     on public.study_sessions (user_id);
create index if not exists ai_conversations_user_id_idx   on public.ai_conversations (user_id);
create index if not exists ai_messages_user_id_idx        on public.ai_messages (user_id);
create index if not exists calendar_feeds_user_id_idx     on public.calendar_feeds (user_id);
create index if not exists deletion_log_user_id_idx       on public.deletion_log (user_id);
create index if not exists share_links_user_id_idx        on public.share_links (user_id);
create index if not exists subscriptions_user_id_idx      on public.subscriptions (user_id);

-- Child-by-parent lookups used on every detail screen -------------------------
create index if not exists subject_specs_subject_id_idx   on public.subject_specs (subject_id);
create index if not exists activity_events_activity_id_idx on public.activity_events (activity_id);

-- Nightly purge scans (0007) ---------------------------------------------------
create index if not exists deletion_log_deleted_at_idx    on public.deletion_log (deleted_at);
create index if not exists share_links_expires_at_idx     on public.share_links (expires_at);
