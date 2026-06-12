-- 03_rls_ai_calendar_system_tables.sql
-- RLS isolation for the remaining user-owned tables:
--   * full owner CRUD  — ai_conversations, ai_messages, daily_motivations,
--                        calendar_feeds, calendar_events, share_links,
--                        deletion_log, device_tokens
--   * read-only mirror — subscriptions, rate_limits: SELECT own only. These
--                        two have NO insert/update/delete policies at all
--                        (0003): subscriptions is written exclusively by the
--                        payment webhooks (service role) and rate_limits only
--                        inside check_rate_limit(), so even own-keyed writes
--                        must fail.
-- Same pattern as 01/02: fixtures created as postgres (table owner, exempt
-- from RLS), then act as user A and prove full access to A's rows and zero
-- access to B's. Parent rows needed by FKs (ai_conversations for ai_messages,
-- calendar_feeds for calendar_events) get DEDICATED fixtures that are never
-- deleted by the assertions, so blocks cannot cascade into each other.

begin;
set local search_path = extensions, public;
create extension if not exists pgtap with schema extensions;

select plan(74);

-- Test users (fires handle_new_user -> profiles rows).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'user-a@markd.test'),
  ('00000000-0000-0000-0000-0000000000bb', 'user-b@markd.test');

-- Dedicated parents (never deleted in this file).
insert into public.ai_conversations (id, user_id, title) values
  ('71000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Parent conversation A'),
  ('71000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Parent conversation B');

insert into public.calendar_feeds (id, user_id, url, label) values
  ('74000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'https://calendar.online/parent-a.ics', 'Parent feed A'),
  ('74000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'https://calendar.online/parent-b.ics', 'Parent feed B');

-- Fixtures under test.
insert into public.ai_conversations (id, user_id, title) values
  ('61000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'Chat A'),
  ('61000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'Chat B');

insert into public.ai_messages (id, user_id, conversation_id, role, content, model) values
  ('62000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa',
   '71000000-0000-0000-0000-00000000000a', 'user', 'Message A', 'claude-haiku'),
  ('62000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb',
   '71000000-0000-0000-0000-00000000000b', 'user', 'Message B', 'claude-haiku');

insert into public.daily_motivations (id, user_id, date, text, model) values
  ('63000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', '2026-06-10', 'Keep going, A', 'claude-haiku'),
  ('63000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', '2026-06-10', 'Keep going, B', 'claude-haiku');

insert into public.calendar_feeds (id, user_id, url) values
  ('64000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'https://calendar.online/a.ics'),
  ('64000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'https://kalender.digital/b.ics');

insert into public.calendar_events (id, user_id, feed_id, uid, title, starts_at) values
  ('65000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa',
   '74000000-0000-0000-0000-00000000000a', 'fixture-a@markd', 'Mock exam (A)', '2026-06-20 09:00+00'),
  ('65000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb',
   '74000000-0000-0000-0000-00000000000b', 'fixture-b@markd', 'Mock exam (B)', '2026-06-20 09:00+00');

insert into public.share_links (id, user_id, slug, payload, expires_at) values
  ('67000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'share-a', '{"owner": "a"}', now() + interval '30 days'),
  ('67000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'share-b', '{"owner": "b"}', now() + interval '30 days');

insert into public.deletion_log (id, user_id, entity_type, entity_id, snapshot) values
  ('66000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'task',
   'e6000000-0000-0000-0000-00000000000a', '{"text": "Task A"}'),
  ('66000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'task',
   'e6000000-0000-0000-0000-00000000000b', '{"text": "Task B"}');

insert into public.device_tokens (id, user_id, expo_push_token, platform) values
  ('68000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'ExponentPushToken[aaaa]', 'ios'),
  ('68000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'ExponentPushToken[bbbb]', 'android');

insert into public.subscriptions (id, user_id, source, product_id, status, period_start, period_end) values
  ('69000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000aa', 'revenuecat',
   'markd_pro_monthly', 'active', now() - interval '1 day', now() + interval '29 days'),
  ('69000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb', 'stripe',
   'markd_pro_yearly', 'trialing', now() - interval '1 day', now() + interval '6 days');

insert into public.rate_limits (user_id, key, window_start, count) values
  ('00000000-0000-0000-0000-0000000000aa', 'ai-chat', date_trunc('hour', now()), 5),
  ('00000000-0000-0000-0000-0000000000bb', 'ai-chat', date_trunc('hour', now()), 7);

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated", "email": "user-a@markd.test"}';

-- --------------------------------------------------------- ai_conversations --
select is((select count(*) from public.ai_conversations where user_id = '00000000-0000-0000-0000-0000000000aa'), 2::bigint,
  'ai_conversations: A sees own rows (fixture + dedicated parent)');
select is((select count(*) from public.ai_conversations where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'ai_conversations: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.ai_conversations (user_id, title) values ('00000000-0000-0000-0000-0000000000aa', 'New chat') $q$,
  'ai_conversations: A can insert own');
select throws_ok(
  $q$ insert into public.ai_conversations (user_id, title) values ('00000000-0000-0000-0000-0000000000bb', 'Spoofed') $q$,
  '42501', null,
  'ai_conversations: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.ai_conversations set title = 'Chat A (renamed)' where id = '61000000-0000-0000-0000-00000000000a' returning id $q$,
  'ai_conversations: A can update own');
select is_empty(
  $q$ update public.ai_conversations set title = 'hax' where id = '61000000-0000-0000-0000-00000000000b' returning id $q$,
  'ai_conversations: A cannot update B''s row');
select is_empty(
  $q$ delete from public.ai_conversations where id = '61000000-0000-0000-0000-00000000000b' returning id $q$,
  'ai_conversations: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.ai_conversations where id = '61000000-0000-0000-0000-00000000000a' returning id $q$,
  'ai_conversations: A can delete own');

-- ------------------------------------------------------------- ai_messages --
select is((select count(*) from public.ai_messages where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'ai_messages: A sees own row');
select is((select count(*) from public.ai_messages where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'ai_messages: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.ai_messages (user_id, conversation_id, role, content)
      values ('00000000-0000-0000-0000-0000000000aa', '71000000-0000-0000-0000-00000000000a', 'assistant', 'Reply to A') $q$,
  'ai_messages: A can insert own');
select throws_ok(
  $q$ insert into public.ai_messages (user_id, conversation_id, role, content)
      values ('00000000-0000-0000-0000-0000000000bb', '71000000-0000-0000-0000-00000000000b', 'user', 'Spoofed') $q$,
  '42501', null,
  'ai_messages: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.ai_messages set content = 'Message A (edited)' where id = '62000000-0000-0000-0000-00000000000a' returning id $q$,
  'ai_messages: A can update own');
select is_empty(
  $q$ update public.ai_messages set content = 'hax' where id = '62000000-0000-0000-0000-00000000000b' returning id $q$,
  'ai_messages: A cannot update B''s row');
select is_empty(
  $q$ delete from public.ai_messages where id = '62000000-0000-0000-0000-00000000000b' returning id $q$,
  'ai_messages: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.ai_messages where id = '62000000-0000-0000-0000-00000000000a' returning id $q$,
  'ai_messages: A can delete own');

-- ------------------------------------------------------- daily_motivations --
select is((select count(*) from public.daily_motivations where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'daily_motivations: A sees own row');
select is((select count(*) from public.daily_motivations where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'daily_motivations: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.daily_motivations (user_id, date, text) values ('00000000-0000-0000-0000-0000000000aa', '2026-06-12', 'Fresh start') $q$,
  'daily_motivations: A can insert own');
select throws_ok(
  $q$ insert into public.daily_motivations (user_id, date, text) values ('00000000-0000-0000-0000-0000000000bb', '2026-06-12', 'Spoofed') $q$,
  '42501', null,
  'daily_motivations: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.daily_motivations set text = 'Keep going, A!' where id = '63000000-0000-0000-0000-00000000000a' returning id $q$,
  'daily_motivations: A can update own');
select is_empty(
  $q$ update public.daily_motivations set text = 'hax' where id = '63000000-0000-0000-0000-00000000000b' returning id $q$,
  'daily_motivations: A cannot update B''s row');
select is_empty(
  $q$ delete from public.daily_motivations where id = '63000000-0000-0000-0000-00000000000b' returning id $q$,
  'daily_motivations: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.daily_motivations where id = '63000000-0000-0000-0000-00000000000a' returning id $q$,
  'daily_motivations: A can delete own');

-- ---------------------------------------------------------- calendar_feeds --
select is((select count(*) from public.calendar_feeds where user_id = '00000000-0000-0000-0000-0000000000aa'), 2::bigint,
  'calendar_feeds: A sees own rows (fixture + dedicated parent)');
select is((select count(*) from public.calendar_feeds where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'calendar_feeds: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.calendar_feeds (user_id, url, label) values ('00000000-0000-0000-0000-0000000000aa', 'https://calendar.online/a2.ics', 'Second feed') $q$,
  'calendar_feeds: A can insert own');
select throws_ok(
  $q$ insert into public.calendar_feeds (user_id, url) values ('00000000-0000-0000-0000-0000000000bb', 'https://calendar.online/spoof.ics') $q$,
  '42501', null,
  'calendar_feeds: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.calendar_feeds set label = 'School calendar' where id = '64000000-0000-0000-0000-00000000000a' returning id $q$,
  'calendar_feeds: A can update own');
select is_empty(
  $q$ update public.calendar_feeds set label = 'hax' where id = '64000000-0000-0000-0000-00000000000b' returning id $q$,
  'calendar_feeds: A cannot update B''s row');
select is_empty(
  $q$ delete from public.calendar_feeds where id = '64000000-0000-0000-0000-00000000000b' returning id $q$,
  'calendar_feeds: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.calendar_feeds where id = '64000000-0000-0000-0000-00000000000a' returning id $q$,
  'calendar_feeds: A can delete own');

-- --------------------------------------------------------- calendar_events --
select is((select count(*) from public.calendar_events where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'calendar_events: A sees own row');
select is((select count(*) from public.calendar_events where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'calendar_events: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.calendar_events (user_id, feed_id, uid, title, starts_at)
      values ('00000000-0000-0000-0000-0000000000aa', '74000000-0000-0000-0000-00000000000a', 'new-a@markd', 'Revision session', '2026-06-25 16:00+00') $q$,
  'calendar_events: A can insert own');
select throws_ok(
  $q$ insert into public.calendar_events (user_id, feed_id, uid, title, starts_at)
      values ('00000000-0000-0000-0000-0000000000bb', '74000000-0000-0000-0000-00000000000b', 'spoof@markd', 'Spoofed', '2026-06-25 16:00+00') $q$,
  '42501', null,
  'calendar_events: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.calendar_events set title = 'Mock exam (A, hall 2)' where id = '65000000-0000-0000-0000-00000000000a' returning id $q$,
  'calendar_events: A can update own');
select is_empty(
  $q$ update public.calendar_events set title = 'hax' where id = '65000000-0000-0000-0000-00000000000b' returning id $q$,
  'calendar_events: A cannot update B''s row');
select is_empty(
  $q$ delete from public.calendar_events where id = '65000000-0000-0000-0000-00000000000b' returning id $q$,
  'calendar_events: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.calendar_events where id = '65000000-0000-0000-0000-00000000000a' returning id $q$,
  'calendar_events: A can delete own');

-- ------------------------------------------------------------- share_links --
select is((select count(*) from public.share_links where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'share_links: A sees own row');
select is((select count(*) from public.share_links where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'share_links: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.share_links (user_id, slug, payload, expires_at)
      values ('00000000-0000-0000-0000-0000000000aa', 'share-a-2', '{"owner": "a"}', now() + interval '30 days') $q$,
  'share_links: A can insert own');
select throws_ok(
  $q$ insert into public.share_links (user_id, slug, payload, expires_at)
      values ('00000000-0000-0000-0000-0000000000bb', 'share-spoof', '{}', now() + interval '30 days') $q$,
  '42501', null,
  'share_links: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.share_links set payload = '{"owner": "a", "v": 2}' where id = '67000000-0000-0000-0000-00000000000a' returning id $q$,
  'share_links: A can update own');
select is_empty(
  $q$ update public.share_links set payload = '{"hax": true}' where id = '67000000-0000-0000-0000-00000000000b' returning id $q$,
  'share_links: A cannot update B''s row');
select is_empty(
  $q$ delete from public.share_links where id = '67000000-0000-0000-0000-00000000000b' returning id $q$,
  'share_links: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.share_links where id = '67000000-0000-0000-0000-00000000000a' returning id $q$,
  'share_links: A can delete own (revoking a share)');

-- ------------------------------------------------------------ deletion_log --
select is((select count(*) from public.deletion_log where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'deletion_log: A sees own row');
select is((select count(*) from public.deletion_log where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'deletion_log: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.deletion_log (user_id, entity_type, entity_id, snapshot)
      values ('00000000-0000-0000-0000-0000000000aa', 'subject', 'e6000000-0000-0000-0000-00000000001a', '{"name": "Latin"}') $q$,
  'deletion_log: A can insert own (soft-delete writes a log row)');
select throws_ok(
  $q$ insert into public.deletion_log (user_id, entity_type, entity_id, snapshot)
      values ('00000000-0000-0000-0000-0000000000bb', 'task', 'e6000000-0000-0000-0000-00000000001b', '{}') $q$,
  '42501', null,
  'deletion_log: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.deletion_log set restored_at = now() where id = '66000000-0000-0000-0000-00000000000a' returning id $q$,
  'deletion_log: A can update own (restore sets restored_at)');
select is_empty(
  $q$ update public.deletion_log set restored_at = now() where id = '66000000-0000-0000-0000-00000000000b' returning id $q$,
  'deletion_log: A cannot update B''s row');
select is_empty(
  $q$ delete from public.deletion_log where id = '66000000-0000-0000-0000-00000000000b' returning id $q$,
  'deletion_log: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.deletion_log where id = '66000000-0000-0000-0000-00000000000a' returning id $q$,
  'deletion_log: A can delete own');

-- ----------------------------------------------------------- device_tokens --
select is((select count(*) from public.device_tokens where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'device_tokens: A sees own row');
select is((select count(*) from public.device_tokens where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'device_tokens: A cannot see B''s rows');
select lives_ok(
  $q$ insert into public.device_tokens (user_id, expo_push_token, platform)
      values ('00000000-0000-0000-0000-0000000000aa', 'ExponentPushToken[aaaa-2]', 'web') $q$,
  'device_tokens: A can insert own');
select throws_ok(
  $q$ insert into public.device_tokens (user_id, expo_push_token, platform)
      values ('00000000-0000-0000-0000-0000000000bb', 'ExponentPushToken[spoof]', 'ios') $q$,
  '42501', null,
  'device_tokens: A cannot insert a row for B');
select isnt_empty(
  $q$ update public.device_tokens set platform = 'android' where id = '68000000-0000-0000-0000-00000000000a' returning id $q$,
  'device_tokens: A can update own');
select is_empty(
  $q$ update public.device_tokens set platform = 'web' where id = '68000000-0000-0000-0000-00000000000b' returning id $q$,
  'device_tokens: A cannot update B''s row');
select is_empty(
  $q$ delete from public.device_tokens where id = '68000000-0000-0000-0000-00000000000b' returning id $q$,
  'device_tokens: A cannot delete B''s row');
select isnt_empty(
  $q$ delete from public.device_tokens where id = '68000000-0000-0000-0000-00000000000a' returning id $q$,
  'device_tokens: A can delete own');

-- ----------------------------------------- subscriptions (read-only mirror) --
select is((select count(*) from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'subscriptions: A sees own subscription row');
select is((select count(*) from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'subscriptions: A cannot see B''s subscription');
select throws_ok(
  $q$ insert into public.subscriptions (user_id, source, status) values ('00000000-0000-0000-0000-0000000000aa', 'stripe', 'active') $q$,
  '42501', null,
  'subscriptions: no insert policy — even an own-keyed insert is rejected (entitlement spoofing)');
select is_empty(
  $q$ update public.subscriptions set status = 'active' where user_id = '00000000-0000-0000-0000-0000000000aa' returning id $q$,
  'subscriptions: no update policy — owner cannot modify own row');
select is_empty(
  $q$ delete from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000aa' returning id $q$,
  'subscriptions: no delete policy — owner cannot remove own row');

-- ------------------------------------------- rate_limits (read-only mirror) --
select is((select count(*) from public.rate_limits where user_id = '00000000-0000-0000-0000-0000000000aa'), 1::bigint,
  'rate_limits: A sees own counter');
select is((select count(*) from public.rate_limits where user_id = '00000000-0000-0000-0000-0000000000bb'), 0::bigint,
  'rate_limits: A cannot see B''s counters');
select throws_ok(
  $q$ insert into public.rate_limits (user_id, key, window_start, count) values ('00000000-0000-0000-0000-0000000000aa', 'spoof', now(), 0) $q$,
  '42501', null,
  'rate_limits: no insert policy — counters move only via check_rate_limit()');
select is_empty(
  $q$ update public.rate_limits set count = 0 where user_id = '00000000-0000-0000-0000-0000000000aa' returning key $q$,
  'rate_limits: no update policy — owner cannot reset own counter');
select is_empty(
  $q$ delete from public.rate_limits where user_id = '00000000-0000-0000-0000-0000000000aa' returning key $q$,
  'rate_limits: no delete policy — owner cannot clear own counter');

select * from finish();
rollback;
