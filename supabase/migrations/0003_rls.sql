-- 0003_rls.sql
-- Row-Level Security: enabled on EVERY table, deny-by-default (enabling RLS
-- with no matching policy denies everything), then explicit owner-keyed
-- policies. All policies are scoped `to authenticated`; `anon` has NO policy
-- on any table, and `service_role` bypasses RLS by design (webhooks, AI
-- functions, scheduled jobs).
--
-- Special cases (documented here and in README):
--  * schools        — shared directory: any authenticated user may SELECT;
--                     INSERT only with created_by = auth.uid() (verified=false
--                     is forced by trigger in 0004); no update/delete for
--                     normal users (admin verification is a service-role op).
--  * profiles       — keyed on auth.uid() = id. No DELETE policy: profile
--                     rows die via the auth.users cascade when the
--                     account-delete Edge Function (service role) removes the
--                     auth user; deleting only the profile row would leave a
--                     half-broken account. plan column protected in 0004.
--  * share_links    — owner-only CRUD. The public NEVER reads the table:
--                     anon access goes exclusively through the SECURITY
--                     DEFINER get_share() RPC (0007); anon table grants are
--                     revoked outright below.
--  * subscriptions  — SELECT own only. INSERT/UPDATE/DELETE intentionally have
--                     no policies: this table mirrors paid entitlements and is
--                     written exclusively by the stripe/revenuecat webhook
--                     functions (service role). A user able to write their own
--                     subscription rows could spoof entitlement checks.
--  * rate_limits    — SELECT own only (a user may inspect their own usage).
--                     Writes happen exclusively inside the SECURITY DEFINER
--                     check_rate_limit() function (0007); user-writable
--                     counters would defeat rate limiting.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default)
-- ---------------------------------------------------------------------------
alter table public.schools            enable row level security;
alter table public.profiles           enable row level security;
alter table public.subjects           enable row level security;
alter table public.subject_specs      enable row level security;
alter table public.tasks              enable row level security;
alter table public.deadlines          enable row level security;
alter table public.exams              enable row level security;
alter table public.papers             enable row level security;
alter table public.goals              enable row level security;
alter table public.portfolio_entries  enable row level security;
alter table public.activities         enable row level security;
alter table public.activity_events    enable row level security;
alter table public.topic_confidence   enable row level security;
alter table public.study_sessions     enable row level security;
alter table public.ai_conversations   enable row level security;
alter table public.ai_messages        enable row level security;
alter table public.daily_motivations  enable row level security;
alter table public.calendar_feeds     enable row level security;
alter table public.calendar_events    enable row level security;
alter table public.deletion_log       enable row level security;
alter table public.share_links        enable row level security;
alter table public.device_tokens      enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.rate_limits        enable row level security;

-- ---------------------------------------------------------------------------
-- schools (special)
-- ---------------------------------------------------------------------------
create policy schools_select_all_authenticated on public.schools
  for select to authenticated
  using (true);

create policy schools_insert_own_submission on public.schools
  for insert to authenticated
  with check (created_by = auth.uid());
-- No UPDATE/DELETE policies: verification & moderation are service-role only.

-- ---------------------------------------------------------------------------
-- profiles (special: keyed on id; no delete; plan guarded by trigger in 0004)
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- Normally created by the handle_new_user trigger; the insert policy is a
-- defensive escape hatch (only your own id can ever be inserted).
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create policy subjects_select_own on public.subjects
  for select to authenticated using (auth.uid() = user_id);
create policy subjects_insert_own on public.subjects
  for insert to authenticated with check (auth.uid() = user_id);
create policy subjects_update_own on public.subjects
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subjects_delete_own on public.subjects
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subject_specs
-- ---------------------------------------------------------------------------
create policy subject_specs_select_own on public.subject_specs
  for select to authenticated using (auth.uid() = user_id);
create policy subject_specs_insert_own on public.subject_specs
  for insert to authenticated with check (auth.uid() = user_id);
create policy subject_specs_update_own on public.subject_specs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subject_specs_delete_own on public.subject_specs
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create policy tasks_select_own on public.tasks
  for select to authenticated using (auth.uid() = user_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);
create policy tasks_update_own on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_delete_own on public.tasks
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- deadlines
-- ---------------------------------------------------------------------------
create policy deadlines_select_own on public.deadlines
  for select to authenticated using (auth.uid() = user_id);
create policy deadlines_insert_own on public.deadlines
  for insert to authenticated with check (auth.uid() = user_id);
create policy deadlines_update_own on public.deadlines
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy deadlines_delete_own on public.deadlines
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- exams
-- ---------------------------------------------------------------------------
create policy exams_select_own on public.exams
  for select to authenticated using (auth.uid() = user_id);
create policy exams_insert_own on public.exams
  for insert to authenticated with check (auth.uid() = user_id);
create policy exams_update_own on public.exams
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exams_delete_own on public.exams
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- papers
-- ---------------------------------------------------------------------------
create policy papers_select_own on public.papers
  for select to authenticated using (auth.uid() = user_id);
create policy papers_insert_own on public.papers
  for insert to authenticated with check (auth.uid() = user_id);
create policy papers_update_own on public.papers
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy papers_delete_own on public.papers
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create policy goals_select_own on public.goals
  for select to authenticated using (auth.uid() = user_id);
create policy goals_insert_own on public.goals
  for insert to authenticated with check (auth.uid() = user_id);
create policy goals_update_own on public.goals
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy goals_delete_own on public.goals
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- portfolio_entries
-- ---------------------------------------------------------------------------
create policy portfolio_entries_select_own on public.portfolio_entries
  for select to authenticated using (auth.uid() = user_id);
create policy portfolio_entries_insert_own on public.portfolio_entries
  for insert to authenticated with check (auth.uid() = user_id);
create policy portfolio_entries_update_own on public.portfolio_entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy portfolio_entries_delete_own on public.portfolio_entries
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create policy activities_select_own on public.activities
  for select to authenticated using (auth.uid() = user_id);
create policy activities_insert_own on public.activities
  for insert to authenticated with check (auth.uid() = user_id);
create policy activities_update_own on public.activities
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy activities_delete_own on public.activities
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- activity_events
-- ---------------------------------------------------------------------------
create policy activity_events_select_own on public.activity_events
  for select to authenticated using (auth.uid() = user_id);
create policy activity_events_insert_own on public.activity_events
  for insert to authenticated with check (auth.uid() = user_id);
create policy activity_events_update_own on public.activity_events
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy activity_events_delete_own on public.activity_events
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- topic_confidence
-- ---------------------------------------------------------------------------
create policy topic_confidence_select_own on public.topic_confidence
  for select to authenticated using (auth.uid() = user_id);
create policy topic_confidence_insert_own on public.topic_confidence
  for insert to authenticated with check (auth.uid() = user_id);
create policy topic_confidence_update_own on public.topic_confidence
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy topic_confidence_delete_own on public.topic_confidence
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------
create policy study_sessions_select_own on public.study_sessions
  for select to authenticated using (auth.uid() = user_id);
create policy study_sessions_insert_own on public.study_sessions
  for insert to authenticated with check (auth.uid() = user_id);
create policy study_sessions_update_own on public.study_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy study_sessions_delete_own on public.study_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_conversations
-- ---------------------------------------------------------------------------
create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated using (auth.uid() = user_id);
create policy ai_conversations_insert_own on public.ai_conversations
  for insert to authenticated with check (auth.uid() = user_id);
create policy ai_conversations_update_own on public.ai_conversations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_conversations_delete_own on public.ai_conversations
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_messages
-- ---------------------------------------------------------------------------
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (auth.uid() = user_id);
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (auth.uid() = user_id);
create policy ai_messages_update_own on public.ai_messages
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_messages_delete_own on public.ai_messages
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- daily_motivations
-- ---------------------------------------------------------------------------
create policy daily_motivations_select_own on public.daily_motivations
  for select to authenticated using (auth.uid() = user_id);
create policy daily_motivations_insert_own on public.daily_motivations
  for insert to authenticated with check (auth.uid() = user_id);
create policy daily_motivations_update_own on public.daily_motivations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy daily_motivations_delete_own on public.daily_motivations
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- calendar_feeds
-- ---------------------------------------------------------------------------
create policy calendar_feeds_select_own on public.calendar_feeds
  for select to authenticated using (auth.uid() = user_id);
create policy calendar_feeds_insert_own on public.calendar_feeds
  for insert to authenticated with check (auth.uid() = user_id);
create policy calendar_feeds_update_own on public.calendar_feeds
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy calendar_feeds_delete_own on public.calendar_feeds
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- calendar_events (spec extension — same owner-only model)
-- ---------------------------------------------------------------------------
create policy calendar_events_select_own on public.calendar_events
  for select to authenticated using (auth.uid() = user_id);
create policy calendar_events_insert_own on public.calendar_events
  for insert to authenticated with check (auth.uid() = user_id);
create policy calendar_events_update_own on public.calendar_events
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy calendar_events_delete_own on public.calendar_events
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- deletion_log
-- ---------------------------------------------------------------------------
create policy deletion_log_select_own on public.deletion_log
  for select to authenticated using (auth.uid() = user_id);
create policy deletion_log_insert_own on public.deletion_log
  for insert to authenticated with check (auth.uid() = user_id);
create policy deletion_log_update_own on public.deletion_log
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy deletion_log_delete_own on public.deletion_log
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- share_links (owner CRUD; the public goes through get_share() ONLY)
-- ---------------------------------------------------------------------------
create policy share_links_select_own on public.share_links
  for select to authenticated using (auth.uid() = user_id);
create policy share_links_insert_own on public.share_links
  for insert to authenticated with check (auth.uid() = user_id);
create policy share_links_update_own on public.share_links
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy share_links_delete_own on public.share_links
  for delete to authenticated using (auth.uid() = user_id);

-- Belt-and-braces: strip anon's default table grants so unauthenticated
-- clients get a hard permission error, not merely an RLS-empty result.
revoke all on table public.share_links from anon;

-- ---------------------------------------------------------------------------
-- device_tokens
-- ---------------------------------------------------------------------------
create policy device_tokens_select_own on public.device_tokens
  for select to authenticated using (auth.uid() = user_id);
create policy device_tokens_insert_own on public.device_tokens
  for insert to authenticated with check (auth.uid() = user_id);
create policy device_tokens_update_own on public.device_tokens
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy device_tokens_delete_own on public.device_tokens
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions (special: read-only mirror for the owner)
-- ---------------------------------------------------------------------------
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies — written only by webhook Edge Functions
-- via the service role (see header comment).

-- ---------------------------------------------------------------------------
-- rate_limits (special: read-only visibility into your own usage)
-- ---------------------------------------------------------------------------
create policy rate_limits_select_own on public.rate_limits
  for select to authenticated using (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies — counters move only inside the SECURITY
-- DEFINER check_rate_limit() function (see header comment).
