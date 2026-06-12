-- 01_rls_core_tables.sql
-- RLS isolation for: subjects, tasks, deadlines, exams, papers.
-- Pattern: create two auth users (A, B) + fixtures as postgres (table owner,
-- exempt from RLS), then act as user A via
--   set local role authenticated; set local request.jwt.claims to '{"sub": <A>}'
-- and prove A can fully CRUD their own rows but cannot touch B's.
-- Cross-tenant UPDATE/DELETE are proven impossible via `... returning` being
-- empty (RLS filters the target rows), cross-tenant INSERT via SQLSTATE 42501.

begin;
set local search_path = extensions, public;
create extension if not exists pgtap with schema extensions;

select plan(40);

-- Test users (fires handle_new_user -> profiles rows).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'user-a@markd.test'),
  ('00000000-0000-0000-0000-0000000000bb', 'user-b@markd.test');

-- Fixtures.
insert into public.subjects (id, user_id, name) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Maths (A)'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Maths (B)');

insert into public.tasks (id, user_id, text) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Task A'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Task B');

insert into public.deadlines (id, user_id, title, date) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Deadline A', '2026-07-01'),
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Deadline B', '2026-07-01');

insert into public.exams (id, user_id, name, date) values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Exam A', '2026-06-20'),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Exam B', '2026-06-20');

insert into public.papers (id, user_id, title, year) values
  ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Paper A', 2025),
  ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Paper B', 2025);

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated", "email": "user-a@markd.test"}';

-- ---------------------------------------------------------------- subjects --
select is((select count(*) from public.subjects where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'subjects: A sees own row');
select is((select count(*) from public.subjects where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'subjects: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.subjects (user_id, name) values ('00000000-0000-0000-0000-0000000000aa', 'Physics (A)') $q$,
  'subjects: A can insert own');
select throws_ok(
  $q$ insert into public.subjects (user_id, name) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'subjects: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.subjects set name = 'Maths (A, renamed)' where id = '10000000-0000-0000-0000-00000000000a' returning id $q$,
  'subjects: A can update own');
select is_empty(
  $q$ update public.subjects set name = 'hax' where id = '10000000-0000-0000-0000-00000000000b' returning id $q$,
  'subjects: A cannot update B''s row');
select is_empty(
  $q$ delete from public.subjects where id = '10000000-0000-0000-0000-00000000000b' returning id $q$,
  'subjects: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.subjects where id = '10000000-0000-0000-0000-00000000000a' returning id $q$,
  'subjects: A can delete own');

-- ------------------------------------------------------------------- tasks --
select is((select count(*) from public.tasks where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'tasks: A sees own row');
select is((select count(*) from public.tasks where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'tasks: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.tasks (user_id, text) values ('00000000-0000-0000-0000-0000000000aa', 'New task') $q$,
  'tasks: A can insert own');
select throws_ok(
  $q$ insert into public.tasks (user_id, text) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'tasks: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.tasks set done = true, completed_at = now() where id = '20000000-0000-0000-0000-00000000000a' returning id $q$,
  'tasks: A can update own');
select is_empty(
  $q$ update public.tasks set text = 'hax' where id = '20000000-0000-0000-0000-00000000000b' returning id $q$,
  'tasks: A cannot update B''s row');
select is_empty(
  $q$ delete from public.tasks where id = '20000000-0000-0000-0000-00000000000b' returning id $q$,
  'tasks: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.tasks where id = '20000000-0000-0000-0000-00000000000a' returning id $q$,
  'tasks: A can delete own');

-- --------------------------------------------------------------- deadlines --
select is((select count(*) from public.deadlines where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'deadlines: A sees own row');
select is((select count(*) from public.deadlines where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'deadlines: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.deadlines (user_id, title, date) values ('00000000-0000-0000-0000-0000000000aa', 'New deadline', '2026-08-01') $q$,
  'deadlines: A can insert own');
select throws_ok(
  $q$ insert into public.deadlines (user_id, title, date) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed', '2026-08-01') $q$,
  '42501', null,
  'deadlines: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.deadlines set notes = 'mine' where id = '30000000-0000-0000-0000-00000000000a' returning id $q$,
  'deadlines: A can update own');
select is_empty(
  $q$ update public.deadlines set notes = 'hax' where id = '30000000-0000-0000-0000-00000000000b' returning id $q$,
  'deadlines: A cannot update B''s row');
select is_empty(
  $q$ delete from public.deadlines where id = '30000000-0000-0000-0000-00000000000b' returning id $q$,
  'deadlines: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.deadlines where id = '30000000-0000-0000-0000-00000000000a' returning id $q$,
  'deadlines: A can delete own');

-- ------------------------------------------------------------------- exams --
select is((select count(*) from public.exams where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'exams: A sees own row');
select is((select count(*) from public.exams where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'exams: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.exams (user_id, name, date) values ('00000000-0000-0000-0000-0000000000aa', 'New exam', '2026-09-01') $q$,
  'exams: A can insert own');
select throws_ok(
  $q$ insert into public.exams (user_id, name, date) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed', '2026-09-01') $q$,
  '42501', null,
  'exams: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.exams set location = 'Hall 1' where id = '40000000-0000-0000-0000-00000000000a' returning id $q$,
  'exams: A can update own');
select is_empty(
  $q$ update public.exams set location = 'hax' where id = '40000000-0000-0000-0000-00000000000b' returning id $q$,
  'exams: A cannot update B''s row');
select is_empty(
  $q$ delete from public.exams where id = '40000000-0000-0000-0000-00000000000b' returning id $q$,
  'exams: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.exams where id = '40000000-0000-0000-0000-00000000000a' returning id $q$,
  'exams: A can delete own');

-- ------------------------------------------------------------------ papers --
select is((select count(*) from public.papers where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'papers: A sees own row');
select is((select count(*) from public.papers where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'papers: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.papers (user_id, title, scored, total) values ('00000000-0000-0000-0000-0000000000aa', 'New paper', 54, 80) $q$,
  'papers: A can insert own');
select throws_ok(
  $q$ insert into public.papers (user_id, title) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'papers: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.papers set notes = 'mine' where id = '50000000-0000-0000-0000-00000000000a' returning id $q$,
  'papers: A can update own');
select is_empty(
  $q$ update public.papers set notes = 'hax' where id = '50000000-0000-0000-0000-00000000000b' returning id $q$,
  'papers: A cannot update B''s row');
select is_empty(
  $q$ delete from public.papers where id = '50000000-0000-0000-0000-00000000000b' returning id $q$,
  'papers: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.papers where id = '50000000-0000-0000-0000-00000000000a' returning id $q$,
  'papers: A can delete own');

select * from finish();
rollback;
