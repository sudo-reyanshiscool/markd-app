-- 04_rls_special_cases.sql
-- The three surfaces that deliberately do NOT follow the owner-CRUD template:
--   * schools         — shared directory: every authenticated user reads ALL
--                       rows; INSERT only as yourself (with check
--                       created_by = auth.uid()) and force_school_unverified
--                       (0004) coerces verified=false whatever the client
--                       sends; no user UPDATE/DELETE — verification and
--                       moderation are service-role operations.
--   * profiles        — keyed on id, not user_id: owner reads/updates own row
--                       only, EXCEPT plan: protect_profile_plan (0004) rejects
--                       owner updates that actually CHANGE plan (entitlements
--                       arrive via webhooks/service role). No DELETE policy —
--                       profiles die via the auth.users cascade.
--   * storage.objects — bucket policies from 0006. Path convention
--                       <user_id>/<filename>: the first folder segment is the
--                       owner's uuid. syllabi is private/owner-only; avatars
--                       is public-read, owner-prefixed write.

begin;
set local search_path = extensions, public;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- Test users (fires handle_new_user -> profiles rows, used in the profiles
-- block below).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'user-a@markd.test'),
  ('00000000-0000-0000-0000-0000000000bb', 'user-b@markd.test');

-- School fixtures, inserted as postgres with no JWT: jwt_role() is NULL, so
-- force_school_unverified does NOT coerce and verified=true is preserved
-- (same mechanism the seed relies on).
insert into public.schools (id, name, domain, country, verified, created_by) values
  ('81000000-0000-0000-0000-000000000001', 'Platform Verified School', 'platform.test', 'United Kingdom', true, null),
  ('81000000-0000-0000-0000-000000000002', 'B''s Submitted School', null, 'Singapore', false, '00000000-0000-0000-0000-0000000000bb');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated", "email": "user-a@markd.test"}';

-- ----------------------------------------------------------------- schools --
select is((select count(*) from public.schools where id = '81000000-0000-0000-0000-000000000001'), 1::bigint,
  'schools: any authenticated user can read platform-verified schools');
select is((select count(*) from public.schools where id = '81000000-0000-0000-0000-000000000002'), 1::bigint,
  'schools: any authenticated user can read schools submitted by other users');
select lives_ok(
  $q$ insert into public.schools (name, country, verified, created_by)
      values ('Riverdale Academy', 'India', true, '00000000-0000-0000-0000-0000000000aa') $q$,
  'schools: A can submit a school attributed to themselves');
select is((select s.verified from public.schools s where s.name = 'Riverdale Academy'), false,
  'schools: trigger forces verified=false on user submissions (client sent true)');
select throws_ok(
  $q$ insert into public.schools (name, created_by) values ('Spoof High', '00000000-0000-0000-0000-0000000000bb') $q$,
  '42501', null,
  'schools: A cannot submit a school attributed to B');
select throws_ok(
  $q$ insert into public.schools (name, created_by) values ('Anonymous High', null) $q$,
  '42501', null,
  'schools: A cannot submit a school without attribution (created_by must be auth.uid())');
select is_empty(
  $q$ update public.schools set verified = true where name = 'Riverdale Academy' returning id $q$,
  'schools: A cannot self-verify their submission (no update policy)');
select is_empty(
  $q$ update public.schools set name = 'hax' where id = '81000000-0000-0000-0000-000000000001' returning id $q$,
  'schools: A cannot update platform rows');
select is_empty(
  $q$ delete from public.schools where id = '81000000-0000-0000-0000-000000000001' returning id $q$,
  'schools: A cannot delete any school (no delete policy)');

-- ---------------------------------------------------------------- profiles --
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'profiles: A sees own profile (created by handle_new_user)');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'profiles: A cannot see B''s profile');
select isnt_empty(
  $q$ update public.profiles set name = 'Student A', theme = 'dark' where id = '00000000-0000-0000-0000-0000000000aa' returning id $q$,
  'profiles: A can update own non-plan fields');
select lives_ok(
  $q$ update public.profiles set plan = 'free', locale = 'en-GB' where id = '00000000-0000-0000-0000-0000000000aa' $q$,
  'profiles: full-row updates that do not CHANGE plan pass the guard trigger');
select throws_ok(
  $q$ update public.profiles set plan = 'pro' where id = '00000000-0000-0000-0000-0000000000aa' $q$,
  '42501', 'profiles.plan may only be changed by the service role',
  'profiles: owner cannot change own plan (entitlement spoofing)');
select is((select p.plan from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000aa'), 'free',
  'profiles: plan is unchanged after the blocked attempt');
select is_empty(
  $q$ update public.profiles set name = 'hax' where id = '00000000-0000-0000-0000-0000000000bb' returning id $q$,
  'profiles: A cannot update B''s profile');
select throws_ok(
  $q$ insert into public.profiles (id, email) values ('00000000-0000-0000-0000-0000000000bb', 'spoof@markd.test') $q$,
  '42501', null,
  'profiles: A cannot insert a profile for another id');
select is_empty(
  $q$ delete from public.profiles where id = '00000000-0000-0000-0000-0000000000aa' returning id $q$,
  'profiles: no delete policy — account deletion is a service-role cascade');

-- ----------------------------------------------------------------- storage --
-- These exercise the LIVE storage.objects policies by writing rows with plain
-- SQL as the authenticated/anon roles — the same roles (and the same RLS
-- evaluation) storage-api uses for uploads. Only public columns are touched
-- (bucket_id, name, metadata) and the buckets are guaranteed by 0006; the
-- storage schema's internal bookkeeping (prefix triggers in newer storage-api
-- versions) is SECURITY DEFINER and transparent here. ENVIRONMENT NOTE: this
-- block assumes the standard storage schema shipped with the Supabase CLI
-- image (`supabase start`); on a stripped-down stack without it, comment the
-- block out and subtract 14 from plan().

-- B uploads their own objects first (also proves the owner-prefix happy path
-- for a second user, without relying on superuser fixture inserts).
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000bb", "role": "authenticated", "email": "user-b@markd.test"}';

select lives_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('syllabi', '00000000-0000-0000-0000-0000000000bb/spec-b.pdf') $q$,
  'storage: B can upload to syllabi under own prefix');
select lives_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('avatars', '00000000-0000-0000-0000-0000000000bb/avatar.png') $q$,
  'storage: B can upload an avatar under own prefix');

-- Back to user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated", "email": "user-a@markd.test"}';

select lives_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('syllabi', '00000000-0000-0000-0000-0000000000aa/spec-a.pdf') $q$,
  'storage: A can upload to syllabi under own prefix');
select throws_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('syllabi', '00000000-0000-0000-0000-0000000000bb/intruder.pdf') $q$,
  '42501', null,
  'storage: A cannot upload into B''s syllabi prefix');
select is((select count(*) from storage.objects where bucket_id = 'syllabi'), 1::bigint,
  'storage: A sees only their own syllabi objects');
select is((select count(*) from storage.objects where bucket_id = 'syllabi' and name like '00000000-0000-0000-0000-0000000000bb/%'), 0::bigint,
  'storage: B''s syllabus object is invisible to A');
select is((select count(*) from storage.objects where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000bb/avatar.png'), 1::bigint,
  'storage: avatars are publicly readable — A can see B''s avatar');
select is_empty(
  $q$ update storage.objects set metadata = '{"hax": true}'::jsonb
      where bucket_id = 'syllabi' and name = '00000000-0000-0000-0000-0000000000bb/spec-b.pdf' returning id $q$,
  'storage: A cannot update B''s syllabus object');
select is_empty(
  $q$ delete from storage.objects
      where bucket_id = 'syllabi' and name = '00000000-0000-0000-0000-0000000000bb/spec-b.pdf' returning id $q$,
  'storage: A cannot delete B''s syllabus object');
select lives_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('avatars', '00000000-0000-0000-0000-0000000000aa/avatar.png') $q$,
  'storage: A can upload an avatar under own prefix');
select throws_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('avatars', '00000000-0000-0000-0000-0000000000bb/spoof.png') $q$,
  '42501', null,
  'storage: A cannot upload into B''s avatar prefix');

-- Unauthenticated access.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is((select count(*) from storage.objects where bucket_id = 'avatars'), 2::bigint,
  'storage: anon can read all avatars (public bucket)');
select is((select count(*) from storage.objects where bucket_id = 'syllabi'), 0::bigint,
  'storage: anon sees no syllabi objects (private bucket)');
select throws_ok(
  $q$ insert into storage.objects (bucket_id, name)
      values ('syllabi', '00000000-0000-0000-0000-0000000000aa/evil.pdf') $q$,
  '42501', null,
  'storage: anon cannot upload to syllabi');

select * from finish();
rollback;
