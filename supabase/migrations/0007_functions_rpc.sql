-- 0007_functions_rpc.sql
-- RPC + maintenance functions, EXECUTE grants, and pg_cron schedules.
--
--   * get_share(p_slug)            — the ONLY public door into share_links
--   * check_rate_limit(...)        — fixed-window counter (service role only)
--   * purge_deletion_log()         — 30-day "recently deleted" retention
--   * purge_expired_share_links()  — drop expired share links
--
-- All four are SECURITY DEFINER (owner: postgres, who owns the tables and is
-- therefore exempt from RLS) with a pinned search_path.

-- ---------------------------------------------------------------------------
-- get_share: public read of a shared snapshot.
-- Returns payload + expiry for a NON-EXPIRED link and increments view_count.
-- A single UPDATE ... RETURNING makes the increment+read atomic (no separate
-- select/update race). Expired or unknown slugs return zero rows — callers
-- cannot distinguish "expired" from "never existed", which avoids slug
-- enumeration oracles. anon/authenticated may EXECUTE this function but have
-- no direct read on the table (anon's table grants are revoked in 0003).
-- ---------------------------------------------------------------------------
create or replace function public.get_share(p_slug text)
returns table (payload jsonb, expires_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.share_links sl
     set view_count = sl.view_count + 1
   where sl.slug = p_slug
     and sl.expires_at > now()
  returning sl.payload, sl.expires_at;
$$;

comment on function public.get_share(text) is
  'Public access path for share links: returns payload+expiry for a live slug and atomically increments view_count. Empty result for unknown/expired slugs.';

revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- check_rate_limit: fixed-window rate limiting for Edge Functions.
-- The window start is aligned to p_window_seconds boundaries (epoch-based), so
-- all calls inside the same window hit the same (user_id, key, window_start)
-- row. Upsert-increments the counter and returns whether THIS call is allowed:
-- calls 1..p_limit return true, every further call in the window returns
-- false (the counter keeps counting for observability).
--
-- EXECUTE is granted to service_role ONLY: Edge Functions must call it through
-- their service-role client. Letting authenticated users execute it would let
-- anyone burn other users' quotas (p_user is a parameter).
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_user uuid,
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be a positive number of seconds';
  end if;
  if p_limit is null or p_limit < 0 then
    raise exception 'p_limit must be >= 0';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (user_id, key, window_start, count)
  values (p_user, p_key, v_window_start, 1)
  on conflict (user_id, key, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

comment on function public.check_rate_limit(uuid, text, int, int) is
  'Fixed-window limiter: increments the (user, key, window) counter and returns true while count <= limit. Service-role only.';

revoke all on function public.check_rate_limit(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- purge_deletion_log: permanently remove "recently deleted" entries older than
-- the 30-day retention window (spec §7.16). Returns rows purged.
-- ---------------------------------------------------------------------------
create or replace function public.purge_deletion_log()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.deletion_log
   where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- purge_expired_share_links: share links expire after 30 days (expires_at set
-- at creation by the share-create Edge Function); drop the dead rows nightly.
-- Returns rows purged.
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_share_links()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.share_links
   where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_deletion_log() from public, anon, authenticated;
grant execute on function public.purge_deletion_log() to service_role;

revoke all on function public.purge_expired_share_links() from public, anon, authenticated;
grant execute on function public.purge_expired_share_links() to service_role;

-- ---------------------------------------------------------------------------
-- Nightly schedules — ONLY when pg_cron is actually installed (guarded so the
-- migration applies cleanly on stacks without it; see 0001). pg_cron >= 1.4
-- upserts by job name, so re-running is idempotent. Jobs run as the scheduling
-- role (postgres), which owns the purge functions.
-- If pg_cron is unavailable, run both purges from an external scheduler (e.g.
-- a scheduled Edge Function or CI cron hitting a service-role RPC) — see README.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'markd-purge-deletion-log',
      '15 3 * * *',                                -- 03:15 UTC nightly
      'select public.purge_deletion_log();'
    );
    perform cron.schedule(
      'markd-purge-expired-share-links',
      '30 3 * * *',                                -- 03:30 UTC nightly
      'select public.purge_expired_share_links();'
    );
  else
    raise notice 'pg_cron not installed: schedule purge_deletion_log() and purge_expired_share_links() externally.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- EXAMPLE (intentionally commented out): invoke the `daily-motivation` Edge
-- Function nightly with pg_cron + pg_net (spec §8.3). Enable on a project
-- where both extensions exist, after storing the project URL and service-role
-- key OUTSIDE source control — e.g. in Supabase Vault or as database settings:
--
--   alter database postgres set app.settings.supabase_url = 'https://<ref>.supabase.co';
--   alter database postgres set app.settings.service_role_key = '<service-role-key>';  -- never commit this
--
-- do $cron_setup$
-- begin
--   if exists (select 1 from pg_extension where extname = 'pg_cron')
--      and exists (select 1 from pg_extension where extname = 'pg_net') then
--     perform cron.schedule(
--       'markd-daily-motivation',
--       '0 2 * * *',                               -- 02:00 UTC nightly
--       $job$
--       select net.http_post(
--         url     := current_setting('app.settings.supabase_url') || '/functions/v1/daily-motivation',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--         ),
--         body    := jsonb_build_object('source', 'pg_cron')
--       );
--       $job$
--     );
--   end if;
-- end;
-- $cron_setup$;
