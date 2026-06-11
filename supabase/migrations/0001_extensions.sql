-- 0001_extensions.sql
-- Extensions used by the Markd schema.
--
-- Notes:
--  * gen_random_uuid() is built into Postgres 13+ (no extension required);
--    pgcrypto is still created for parity with hosted Supabase projects.
--  * pg_cron / pg_net are OPTIONAL: they exist in the Supabase images but may
--    be unavailable in other environments, so their creation is guarded and
--    failure is non-fatal. Migration 0007 only schedules jobs when pg_cron is
--    actually installed (it checks pg_extension at runtime).

create extension if not exists pgcrypto with schema extensions;

-- pg_cron: nightly maintenance jobs (deletion_log + share_links purges).
-- Not relocatable; it installs its own `cron` schema.
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron is not available in this environment (%). Nightly purges must be scheduled externally.', sqlerrm;
end;
$$;

-- pg_net: async HTTP from the database; only needed for the (commented)
-- example in 0007 that invokes the daily-motivation Edge Function on a cron.
do $$
begin
  create extension if not exists pg_net;
exception
  when others then
    raise notice 'pg_net is not available in this environment (%). Edge Function cron invocation example in 0007 will not apply.', sqlerrm;
end;
$$;
