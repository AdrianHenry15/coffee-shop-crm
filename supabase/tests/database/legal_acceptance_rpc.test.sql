BEGIN;

SELECT plan(11);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'a4200000-0000-4000-8000-000000000001',
    'legal-rpc-first@example.test',
    '{}'::jsonb
  ),
  (
    'a4200000-0000-4000-8000-000000000002',
    'legal-rpc-second@example.test',
    '{}'::jsonb
  );

-- No authenticated identity.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

SELECT throws_ok(
  $$SELECT public.accept_current_legal_documents(
    '2026-11-03', '2026-11-03'
  )$$,
  '42501',
  'Authentication required',
  'Acceptance requires an authenticated identity'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.accept_current_legal_documents(text,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.has_current_legal_acceptance()',
    'EXECUTE'
  ),
  'Anonymous callers cannot execute the legal RPCs'
);

-- Act as the first account through the authenticated role.
SELECT set_config(
  'request.jwt.claim.sub',
  'a4200000-0000-4000-8000-000000000001',
  true
);

SET LOCAL ROLE authenticated;

SELECT is(
  public.has_current_legal_acceptance(),
  false,
  'An account without a receipt needs acceptance'
);

SELECT throws_ok(
  $$SELECT public.accept_current_legal_documents(
    'outdated', '2026-11-03'
  )$$,
  '22023',
  'Legal documents changed. Reload before accepting.',
  'Rejects an outdated document version'
);

SELECT throws_ok(
  $$SELECT public.accept_current_legal_documents(
    NULL, '2026-11-03'
  )$$,
  '22023',
  'Legal documents changed. Reload before accepting.',
  'Rejects a missing document version'
);

SELECT lives_ok(
  $$SELECT public.accept_current_legal_documents(
    '2026-11-03', '2026-11-03'
  )$$,
  'The account can accept the current documents'
);

SELECT is(
  public.has_current_legal_acceptance(),
  true,
  'The account now has current acceptance'
);

RESET ROLE;

-- Capture the original receipt to verify repeated calls preserve it.
CREATE TEMP TABLE legal_receipt_snapshot ON COMMIT DROP AS
SELECT recorded_at, source
FROM private.account_legal_acceptances
WHERE user_id = 'a4200000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.accept_current_legal_documents(
    '2026-11-03', '2026-11-03'
  )$$,
  'Repeated acceptance succeeds'
);

-- Changing the caller must not expose the first account’s acceptance.
SELECT set_config(
  'request.jwt.claim.sub',
  'a4200000-0000-4000-8000-000000000002',
  true
);

SELECT is(
  public.has_current_legal_acceptance(),
  false,
  'Acceptance belongs only to the account that submitted it'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)
    FROM private.account_legal_acceptances
    WHERE user_id = 'a4200000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Repeated calls create only one receipt for these versions'
);

SELECT ok(
  (
    SELECT
      acceptance.recorded_at = snapshot.recorded_at
      AND acceptance.source = 'authenticated_acceptance'
      AND acceptance.source = snapshot.source
    FROM private.account_legal_acceptances AS acceptance
    CROSS JOIN legal_receipt_snapshot AS snapshot
    WHERE acceptance.user_id =
      'a4200000-0000-4000-8000-000000000001'
  ),
  'Repeated acceptance preserves the timestamp and source'
);

SELECT * FROM finish();

ROLLBACK;