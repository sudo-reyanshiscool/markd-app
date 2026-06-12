-- 02_rls_children_tables.sql
-- RLS isolation for: goals, portfolio_entries, activities, activity_events,
-- topic_confidence, study_sessions, subject_specs.
-- Parent rows needed by FKs (subjects for topic_confidence/subject_specs,
-- activities for activity_events) get DEDICATED fixtures that are never
-- deleted by the assertions, so blocks cannot cascade into each other.

begin;
set local search_path = extensions, public;
create extension if not exists pgtap with schema extensions;

select plan(56);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'user-a@markd.test'),
  ('00000000-0000-0000-0000-0000000000bb', 'user-b@markd.test');

-- Dedicated parents (never deleted in this file).
insert into public.subjects (id, user_id, name) values
  ('11110000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Parent subject A'),
  ('11110000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Parent subject B');

insert into public.activities (id, user_id, name) values
  ('36000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Parent activity A'),
  ('36000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Parent activity B');

-- Fixtures under test.
insert into public.goals (id, user_id, text, horizon) values
  ('17000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Goal A', '3m'),
  ('17000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Goal B', '6m');

insert into public.portfolio_entries (id, user_id, title, type) values
  ('18000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Entry A', 'project'),
  ('18000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Entry B', 'achievement');

insert into public.activities (id, user_id, name) values
  ('16000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Chess club (A)'),
  ('16000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Debate (B)');

insert into public.activity_events (id, activity_id, user_id, title) values
  ('26000000-0000-0000-0000-00000000000a', '36000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Event A'),
  ('26000000-0000-0000-0000-00000000000b', '36000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Event B');

insert into public.topic_confidence (id, user_id, subject_id, topic, confidence) values
  ('27000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', '11110000-0000-0000-0000-00000000000a', 'Algebra', 60),
  ('27000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', '11110000-0000-0000-0000-00000000000b', 'Algebra', 40);

insert into public.study_sessions (id, user_id, minutes) values
  ('28000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 25),
  ('28000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 45);

insert into public.subject_specs (id, subject_id, user_id, storage_path, file_name, mime, size_bytes) values
  ('29000000-0000-0000-0000-00000000000a', '11110000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa',
   '00000000-0000-0000-0000-0000000000aa/spec-a.pdf', 'spec-a.pdf', 'application/pdf', 1024),
  ('29000000-0000-0000-0000-00000000000b', '11110000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb',
   '00000000-0000-0000-0000-0000000000bb/spec-b.pdf', 'spec-b.pdf', 'application/pdf', 2048);

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated", "email": "user-a@markd.test"}';

-- ------------------------------------------------------------------- goals --
select is((select count(*) from public.goals where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'goals: A sees own row');
select is((select count(*) from public.goals where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'goals: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.goals (user_id, text, horizon) values ('00000000-0000-0000-0000-0000000000aa', 'New goal', '12m') $q$,
  'goals: A can insert own');
select throws_ok(
  $q$ insert into public.goals (user_id, text) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'goals: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.goals set done = true, completed_at = now() where id = '17000000-0000-0000-0000-00000000000a' returning id $q$,
  'goals: A can update own');
select is_empty(
  $q$ update public.goals set text = 'hax' where id = '17000000-0000-0000-0000-00000000000b' returning id $q$,
  'goals: A cannot update B''s row');
select is_empty(
  $q$ delete from public.goals where id = '17000000-0000-0000-0000-00000000000b' returning id $q$,
  'goals: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.goals where id = '17000000-0000-0000-0000-00000000000a' returning id $q$,
  'goals: A can delete own');

-- ------------------------------------------------------- portfolio_entries --
select is((select count(*) from public.portfolio_entries where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'portfolio_entries: A sees own row');
select is((select count(*) from public.portfolio_entries where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'portfolio_entries: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.portfolio_entries (user_id, title, type, tags) values ('00000000-0000-0000-0000-0000000000aa', 'New entry', 'competition', '{stem,2026}') $q$,
  'portfolio_entries: A can insert own');
select throws_ok(
  $q$ insert into public.portfolio_entries (user_id, title) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'portfolio_entries: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.portfolio_entries set description = 'mine' where id = '18000000-0000-0000-0000-00000000000a' returning id $q$,
  'portfolio_entries: A can update own');
select is_empty(
  $q$ update public.portfolio_entries set description = 'hax' where id = '18000000-0000-0000-0000-00000000000b' returning id $q$,
  'portfolio_entries: A cannot update B''s row');
select is_empty(
  $q$ delete from public.portfolio_entries where id = '18000000-0000-0000-0000-00000000000b' returning id $q$,
  'portfolio_entries: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.portfolio_entries where id = '18000000-0000-0000-0000-00000000000a' returning id $q$,
  'portfolio_entries: A can delete own');

-- -------------------------------------------------------------- activities --
select is((select count(*) from public.activities where user_id = '00000000-0000-0000-0000-0000000000aa'), 2::bigint,
  'activities: A sees own rows (fixture + dedicated parent)');
select is((select count(*) from public.activities where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'activities: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.activities (user_id, name, hours_per_week) values ('00000000-0000-0000-0000-0000000000aa', 'Robotics', 2.5) $q$,
  'activities: A can insert own');
select throws_ok(
  $q$ insert into public.activities (user_id, name) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'activities: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.activities set role = 'Captain' where id = '16000000-0000-0000-0000-00000000000a' returning id $q$,
  'activities: A can update own');
select is_empty(
  $q$ update public.activities set role = 'hax' where id = '16000000-0000-0000-0000-00000000000b' returning id $q$,
  'activities: A cannot update B''s row');
select is_empty(
  $q$ delete from public.activities where id = '16000000-0000-0000-0000-00000000000b' returning id $q$,
  'activities: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.activities where id = '16000000-0000-0000-0000-00000000000a' returning id $q$,
  'activities: A can delete own');

-- --------------------------------------------------------- activity_events --
select is((select count(*) from public.activity_events where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'activity_events: A sees own row');
select is((select count(*) from public.activity_events where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'activity_events: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.activity_events (activity_id, user_id, title, date) values ('36000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'New milestone', '2026-06-15') $q$,
  'activity_events: A can insert own');
select throws_ok(
  $q$ insert into public.activity_events (activity_id, user_id, title) values ('36000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'activity_events: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.activity_events set description = 'mine' where id = '26000000-0000-0000-0000-00000000000a' returning id $q$,
  'activity_events: A can update own');
select is_empty(
  $q$ update public.activity_events set description = 'hax' where id = '26000000-0000-0000-0000-00000000000b' returning id $q$,
  'activity_events: A cannot update B''s row');
select is_empty(
  $q$ delete from public.activity_events where id = '26000000-0000-0000-0000-00000000000b' returning id $q$,
  'activity_events: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.activity_events where id = '26000000-0000-0000-0000-00000000000a' returning id $q$,
  'activity_events: A can delete own');

-- -------------------------------------------------------- topic_confidence --
select is((select count(*) from public.topic_confidence where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'topic_confidence: A sees own row');
select is((select count(*) from public.topic_confidence where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'topic_confidence: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.topic_confidence (user_id, subject_id, topic, confidence) values ('00000000-0000-0000-0000-0000000000aa', '11110000-0000-0000-0000-00000000000a', 'Calculus', 70) $q$,
  'topic_confidence: A can insert own');
select throws_ok(
  $q$ insert into public.topic_confidence (user_id, subject_id, topic, confidence) values ('00000000-0000-0000-0000-0000000000bb', '11110000-0000-0000-0000-00000000000b', 'Spoofed', 10) $q$,
  '42501', null,
  'topic_confidence: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.topic_confidence set confidence = 80 where id = '27000000-0000-0000-0000-00000000000a' returning id $q$,
  'topic_confidence: A can update own');
select is_empty(
  $q$ update public.topic_confidence set confidence = 1 where id = '27000000-0000-0000-0000-00000000000b' returning id $q$,
  'topic_confidence: A cannot update B''s row');
select is_empty(
  $q$ delete from public.topic_confidence where id = '27000000-0000-0000-0000-00000000000b' returning id $q$,
  'topic_confidence: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.topic_confidence where id = '27000000-0000-0000-0000-00000000000a' returning id $q$,
  'topic_confidence: A can delete own');

-- ---------------------------------------------------------- study_sessions --
select is((select count(*) from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'study_sessions: A sees own row');
select is((select count(*) from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'study_sessions: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.study_sessions (user_id, minutes, started_at) values ('00000000-0000-0000-0000-0000000000aa', 45, now()) $q$,
  'study_sessions: A can insert own');
select throws_ok(
  $q$ insert into public.study_sessions (user_id, minutes) values ('00000000-0000-0000-0000-0000000000bb', 5) $q$,
  '42501', null,
  'study_sessions: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.study_sessions set minutes = 30 where id = '28000000-0000-0000-0000-00000000000a' returning id $q$,
  'study_sessions: A can update own');
select is_empty(
  $q$ update public.study_sessions set minutes = 1 where id = '28000000-0000-0000-0000-00000000000b' returning id $q$,
  'study_sessions: A cannot update B''s row');
select is_empty(
  $q$ delete from public.study_sessions where id = '28000000-0000-0000-0000-00000000000b' returning id $q$,
  'study_sessions: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.study_sessions where id = '28000000-0000-0000-0000-00000000000a' returning id $q$,
  'study_sessions: A can delete own');

-- ----------------------------------------------------------- subject_specs --
select is((select count(*) from public.subject_specs where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'subject_specs: A sees own row');
select is((select count(*) from public.subject_specs where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'subject_specs: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.subject_specs (subject_id, user_id, storage_path, file_name, mime, size_bytes)
      values ('11110000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa',
              '00000000-0000-0000-0000-0000000000aa/new-spec.pdf', 'new-spec.pdf', 'application/pdf', 4096) $q$,
  'subject_specs: A can insert own');
select throws_ok(
  $q$ insert into public.subject_specs (subject_id, user_id, storage_path, file_name, mime, size_bytes)
      values ('11110000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb',
              '00000000-0000-0000-0000-0000000000bb/spoof.pdf', 'spoof.pdf', 'application/pdf', 1) $q$,
  '42501', null,
  'subject_specs: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.subject_specs set year = '2026' where id = '29000000-0000-0000-0000-00000000000a' returning id $q$,
  'subject_specs: A can update own');
select is_empty(
  $q$ update public.subject_specs set year = 'hax' where id = '29000000-0000-0000-0000-00000000000b' returning id $q$,
  'subject_specs: A cannot update B''s row');
select is_empty(
  $q$ delete from public.subject_specs where id = '29000000-0000-0000-0000-00000000000b' returning id $q$,
  'subject_specs: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.subject_specs where id = '29000000-0000-0000-0000-00000000000a' returning id $q$,
  'subject_specs: A can delete own');

select * from finish();
rollback;
