BEGIN;

SELECT plan(10);

INSERT INTO auth.users (
  id,
  email,
  raw_user_meta_data
)
VALUES (
  'a4100000-0000-4000-8000-000000000001',
  'legal-accepted@example.test',
  '{
    "first_name": "Legal",
    "last_name": "Accepted",
    "legal_accepted": true,
    "terms_version": "2026-11-03",
    "privacy_version": "2026-11-03"
  }'::jsonb
);

SELECT is(
  (
    SELECT terms_version
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  '2026-11-03',
  'Records the declared Terms version'
);

SELECT is(
  (
    SELECT privacy_version
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  '2026-11-03',
  'Records the declared Privacy Notice version'
);

SELECT ok(
  (
    SELECT recorded_at IS NOT NULL
      AND recorded_at <= clock_timestamp()
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  'Uses a database timestamp'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.profiles
    WHERE id = 'a4100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Existing profile creation still works'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.account_details
    WHERE user_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Existing account detail creation still works'
);

UPDATE auth.users
SET raw_user_meta_data = '{}'::jsonb
WHERE id = 'a4100000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT terms_version
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  '2026-11-03',
  'Editing metadata does not change the recorded version'
);

INSERT INTO auth.users (
  id,
  email,
  raw_user_meta_data
)
VALUES (
  'a4100000-0000-4000-8000-000000000002',
  'legal-undeclared@example.test',
  '{}'::jsonb
);

SELECT is(
  (
    SELECT count(*)
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4100000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'Does not invent acceptance when no declaration was submitted'
);

SELECT ok(
  NOT has_table_privilege(
    'anon',
    'private.account_legal_acceptances',
    'SELECT, INSERT, UPDATE, DELETE'
  ),
  'Anonymous users have no direct receipt access'
);

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'private.account_legal_acceptances',
    'SELECT, INSERT, UPDATE, DELETE'
  ),
  'Authenticated users have no direct receipt access'
);

DELETE FROM auth.users
WHERE id = 'a4100000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT count(*)
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4100000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Account deletion removes its acceptance receipt'
);

SELECT * FROM finish();

ROLLBACK;