-- 0004_triggers.sql
-- Trigger functions + triggers:
--   * jwt_role()              — helper: role claim of the current request JWT
--   * handle_new_user         — auth.users -> profiles bootstrap
--   * set_updated_at          — profiles, subjects, ai_conversations, subscriptions
--   * protect_profile_plan    — owners cannot change profiles.plan
--   * force_school_unverified — user-submitted schools are never verified

-- ---------------------------------------------------------------------------
-- jwt_role(): returns the `role` claim of the current PostgREST request
-- ('authenticated' | 'anon' | 'service_role'), or NULL when there is no JWT —
-- i.e. direct database access: migrations, seeds, psql, pg_cron jobs.
-- Used by the guard triggers below to tell end-user requests apart from
-- privileged/server contexts.
-- ---------------------------------------------------------------------------
create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;

comment on function public.jwt_role() is
  'role claim of the current request JWT; NULL for direct DB access (migrations, seeds, cron).';

-- ---------------------------------------------------------------------------
-- handle_new_user: after a row lands in auth.users, create its profile.
-- SECURITY DEFINER (owner: postgres) so the auth admin role can write into
-- public.profiles. Assumes email is always present (Markd auth is
-- email+password and Sign in with Apple with the email scope).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists handle_new_user on auth.users;
create trigger handle_new_user
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- set_updated_at: classic touch trigger.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- protect_profile_plan: profiles.plan mirrors the paid entitlement and may
-- only be written by the payment webhooks / server jobs.
--
-- Mechanism (documented choice): a BEFORE UPDATE trigger rather than a column
-- grant, because (a) RLS policies cannot express per-column rules, and
-- (b) column-level REVOKEs on UPDATE would make innocent full-row upserts from
-- the client fail even when plan is unchanged. The trigger rejects only
-- updates that actually CHANGE plan and that originate from a non-service-role
-- JWT. Requests with no JWT (migrations, seeds, pg_cron) and service-role
-- requests pass through.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.plan is distinct from old.plan
     and coalesce(public.jwt_role(), 'service_role') <> 'service_role' then
    raise exception 'profiles.plan may only be changed by the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_plan
  before update on public.profiles
  for each row execute function public.protect_profile_plan();

-- ---------------------------------------------------------------------------
-- force_school_unverified: user-submitted schools always start unverified,
-- whatever the client sends. Coercion (rather than rejection) keeps the
-- onboarding "add my school" flow friction-free. Only applies to end-user
-- (authenticated) requests, so seeds and service-role admin tooling can still
-- create/maintain verified rows.
-- ---------------------------------------------------------------------------
create or replace function public.force_school_unverified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.jwt_role() = 'authenticated' then
    new.verified := false;
  end if;
  return new;
end;
$$;

create trigger force_school_unverified
  before insert on public.schools
  for each row execute function public.force_school_unverified();

-- Trigger functions are not directly callable (they return `trigger`), but
-- keep their EXECUTE surface tidy anyway.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_plan() from public, anon, authenticated;
revoke all on function public.force_school_unverified() from public, anon, authenticated;
