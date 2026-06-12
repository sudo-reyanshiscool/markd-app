-- 05_functions.sql
-- Behaviour of the database functions (0004 + 0007):
--   * handle_new_user            — inserting an auth user creates its profile
--                                  (email lowercased, plan defaults to free).
--   * check_rate_limit           — fixed window: calls 1..limit return true,
--                                  further calls in the window return false
--                                  while the counter keeps counting; keys are
--                                  independent; bad args raise; EXECUTE is
--                                  service-role only.
--   * get_share                  — the only public door into share_links:
--                                  live slug returns the payload and bumps
--                                  view_count atomically; expired and unknown
--                                  slugs are indistinguishable (zero rows, no
--                                  view bump); anon has no direct table access.
--   * purge_deletion_log /       — nightly retention jobs: delete rows past
--     purge_expired_share_links    30 days / past expiry, return the count,
--                                  leave fresh rows alone; not callable by
--                                  end users.
-- Function calls run as postgres (function owner). Role-surface checks switch
-- to anon/authenticated like the RLS files. now() is frozen inside the test
-- transaction, so all check_rate_limit calls land in the same window by
-- construction.

begin;
set local search_path = extensions, public;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- Test users. C's mixed-case email exercises the lower() in handle_new_user.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'user-a@markd.test'),
  ('00000000-0000-0000-0000-0000000000cc', 'User-C@MARKD.Test');

-- Share links owned by A: one live + one expired for get_share, one live +
-- one expired for the purge assertions at the end.
insert into public.share_links (id, user_id, slug, payload, expires_at) values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'live-abc123',
   '{"kind": "markd-share", "student": "A"}', now() + interval '30 days'),
  ('91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'gone-xyz789',
   '{"kind": "markd-share", "student": "A"}', now() - interval '1 day'),
  ('91000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'keep-me',
   '{"kind": "markd-share", "student": "A"}', now() + interval '10 days'),
  ('91000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000aa', 'purge-me',
   '{"kind": "markd-share", "student": "A"}', now() - interval '10 days');

-- Recently-deleted entries: one past the 30-day retention, one fresh.
insert into public.deletion_log (id, user_id, entity_type, entity_id, snapshot, deleted_at) values
  ('92000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'task',
   'e9000000-0000-0000-0000-000000000001', '{"text": "ancient task"}', now() - interval '31 days'),
  ('92000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'subject',
   'e9000000-0000-0000-0000-000000000002', '{"name": "recent subject"}', now() - interval '1 day');

-- --------------------------------------------------------- handle_new_user --
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000cc'), 1::bigint,
  'handle_new_user: inserting an auth user creates its profile row');
select is((select p.email from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000cc'), 'user-c@markd.test',
  'handle_new_user: email is lowercased');
select is((select p.plan from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000cc'), 'free',
  'handle_new_user: plan defaults to free');

-- -------------------------------------------------------- check_rate_limit --
select is(public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'ai-chat', 3, 3600), true,
  'check_rate_limit: call 1 of limit 3 is allowed');
select is(public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'ai-chat', 3, 3600), true,
  'check_rate_limit: call 2 of limit 3 is allowed');
select is(public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'ai-chat', 3, 3600), true,
  'check_rate_limit: call 3 (count = limit) is still allowed');
select is(public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'ai-chat', 3, 3600), false,
  'check_rate_limit: call 4 in the same window is denied');
select is((select rl.count from public.rate_limits rl
            where rl.user_id = '00000000-0000-0000-0000-0000000000aa' and rl.key = 'ai-chat'), 4,
  'check_rate_limit: the counter keeps counting beyond the limit (observability)');
select is(public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'calendar-import', 3, 3600), true,
  'check_rate_limit: each key gets an independent window');
select is(public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'zero-quota', 0, 3600), false,
  'check_rate_limit: a limit of 0 denies the first call');
select throws_ok(
  $q$ select public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'bad-window', 3, 0) $q$,
  'P0001', 'p_window_seconds must be a positive number of seconds',
  'check_rate_limit: zero/negative window raises');
select throws_ok(
  $q$ select public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'bad-limit', -1, 3600) $q$,
  'P0001', 'p_limit must be >= 0',
  'check_rate_limit: negative limit raises');

-- --------------------------------------------------- get_share (anon path) --
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is((select payload from public.get_share('live-abc123')), '{"kind": "markd-share", "student": "A"}'::jsonb,
  'get_share: anon receives the payload of a live slug');
select is_empty(
  $q$ select * from public.get_share('gone-xyz789') $q$,
  'get_share: expired slug returns zero rows');
select is_empty(
  $q$ select * from public.get_share('never-was') $q$,
  'get_share: unknown slug returns zero rows (indistinguishable from expired — no enumeration oracle)');
select throws_ok(
  $q$ select count(*) from public.share_links $q$,
  '42501', null,
  'share_links: anon has no direct table access (grants revoked in 0003)');
select throws_ok(
  $q$ select public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'denied', 1, 60) $q$,
  '42501', null,
  'check_rate_limit: anon cannot execute it');

-- Back to postgres to inspect side effects.
reset role;
set local request.jwt.claims to '';

select is((select sl.view_count from public.share_links sl where sl.slug = 'live-abc123'), 1,
  'get_share: view_count was incremented exactly once');
select is((select sl.view_count from public.share_links sl where sl.slug = 'gone-xyz789'), 0,
  'get_share: an expired slug does not bump view_count');

-- ------------------------------------------- function surface as a user --
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated", "email": "user-a@markd.test"}';

select isnt_empty(
  $q$ select * from public.get_share('live-abc123') $q$,
  'get_share: authenticated users may call it too');
select throws_ok(
  $q$ select public.check_rate_limit('00000000-0000-0000-0000-0000000000aa', 'denied', 1, 60) $q$,
  '42501', null,
  'check_rate_limit: authenticated cannot execute it (could burn other users'' quotas)');
select throws_ok(
  $q$ select public.purge_deletion_log() $q$,
  '42501', null,
  'purge_deletion_log: end users cannot execute the purge');
select throws_ok(
  $q$ select public.purge_expired_share_links() $q$,
  '42501', null,
  'purge_expired_share_links: end users cannot execute the purge');

-- ---------------------------------------------------------- purge functions --
reset role;
set local request.jwt.claims to '';

select is(public.purge_deletion_log(), 1,
  'purge_deletion_log: removes exactly the rows past the 30-day retention');
select is((select count(*) from public.deletion_log where id = '92000000-0000-0000-0000-000000000001'), 0::bigint,
  'purge_deletion_log: the 31-day-old entry is gone');
select is((select count(*) from public.deletion_log where id = '92000000-0000-0000-0000-000000000002'), 1::bigint,
  'purge_deletion_log: the 1-day-old entry survives');
select is(public.purge_expired_share_links(), 2,
  'purge_expired_share_links: removes both expired links');
select is((select count(*) from public.share_links where expires_at < now()), 0::bigint,
  'purge_expired_share_links: no expired links remain');
select is((select count(*) from public.share_links), 2::bigint,
  'purge_expired_share_links: live links survive the purge');

select * from finish();
rollback;
