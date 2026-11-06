BEGIN;

SELECT plan(5);

INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES (
  'a4300000-0000-4000-8000-000000000001',
  'legal-join@example.test',
  now(),
  '{}'::jsonb
);

SELECT set_config('request.jwt.claims', '{}', true);

SELECT set_config(
  'request.jwt.claim.sub',
  'a4300000-0000-4000-8000-000000000001',
  true
);

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.onboard_organization(
      'Legal Gate Test',
      'legal-gate-test',
      'legal-join@example.test',
      '',
      '',
      '',
      'UTC'
    )
  $$,
  '42501',
  'Current legal acceptance is required',
  'Direct onboarding requires legal acceptance'
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      'a4300000-0000-4000-8000-000000000099'
    )
  $$,
  '42501',
  'Current legal acceptance is required',
  'Direct invitation acceptance requires legal acceptance'
);

SELECT lives_ok(
  $$
    SELECT public.accept_current_legal_documents(
      '2026-11-03',
      '2026-11-03'
    )
  $$,
  'The caller can record acceptance'
);

SELECT throws_ok(
  $$
    SELECT public.onboard_organization(
      '',
      'legal-gate-test',
      'legal-join@example.test',
      '',
      '',
      '',
      'UTC'
    )
  $$,
  '22023',
  'Business name must contain 1–100 characters',
  'After acceptance, onboarding reaches its existing validation'
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      'a4300000-0000-4000-8000-000000000099'
    )
  $$,
  '42501',
  'Invitation is unavailable',
  'After acceptance, invitation lookup still protects access'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;