-- seed.sql — local development seed data.
-- A starter directory of well-known verified schools (UK + international) for
-- the onboarding typeahead. created_by is NULL (platform-seeded, not
-- user-submitted). Runs as postgres with no JWT, so the
-- force_school_unverified trigger does NOT coerce these (it only fires for
-- authenticated end-user requests) and verified=true is preserved.

insert into public.schools (name, domain, country, verified, created_by) values
  ('Eton College',                             'etoncollege.org.uk',     'United Kingdom',       true, null),
  ('Harrow School',                            'harrowschool.org.uk',    'United Kingdom',       true, null),
  ('Westminster School',                       'westminster.org.uk',     'United Kingdom',       true, null),
  ('Cheltenham Ladies'' College',              'cheltladiescollege.org', 'United Kingdom',       true, null),
  ('Manchester Grammar School',                'mgs.org',                'United Kingdom',       true, null),
  ('Sevenoaks School',                         'sevenoaksschool.org',    'United Kingdom',       true, null),
  ('The British School, New Delhi',            'british-school.org',     'India',                true, null),
  ('United World College of South East Asia',  'uwcsea.edu.sg',          'Singapore',            true, null),
  ('International School of Geneva',           'ecolint.ch',             'Switzerland',          true, null),
  ('Dubai College',                            'dubaicollege.org',       'United Arab Emirates', true, null),
  ('Jakarta Intercultural School',             'jisedu.or.id',           'Indonesia',            true, null),
  ('St Julian''s School',                      'stjulians.com',          'Portugal',             true, null);
