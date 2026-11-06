BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(12);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

INSERT INTO public.organizations (id, name, slug)
VALUES (
  'a4400000-0000-4000-8000-000000000001',
  'Public Lead Test',
  'public-lead-submission-test'
);

UPDATE public.organization_subscriptions
SET plan_id = 'pro', status = 'active'
WHERE organization_id = 'a4400000-0000-4000-8000-000000000001';

INSERT INTO public.organization_lead_forms (
  id, organization_id, enabled, title
)
VALUES (
  'a4400000-0000-4000-8000-000000000002',
  'a4400000-0000-4000-8000-000000000001',
  false,
  'Contact us'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.submit_public_lead(uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'Anonymous clients cannot call the submission RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.submit_public_lead(uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'Signed-in browser clients cannot call the submission RPC'
);

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      'a4400000-0000-4000-8000-000000000003',
      'Test Customer', 'CUSTOMER@example.test', '',
      'Please send me a quote.'
    )
  $$,
  'P0002',
  'Contact form is unavailable',
  'Disabled forms reject submissions'
);

RESET ROLE;

UPDATE public.organization_lead_forms
SET enabled = true
WHERE id = 'a4400000-0000-4000-8000-000000000002';

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      'a4400000-0000-4000-8000-000000000003',
      'Test Customer', 'CUSTOMER@example.test', '',
      'Please send me a quote.'
    )
  $$,
  'An enabled form accepts a valid submission'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.leads
    WHERE organization_id = 'a4400000-0000-4000-8000-000000000001'
      AND source_form_id = 'a4400000-0000-4000-8000-000000000002'
      AND source = 'website_form'
      AND status = 'new'
      AND email = 'customer@example.test'
      AND phone IS NULL
      AND notes = 'Please send me a quote.'
  ),
  'Submission creates a normalized lead in the correct workspace'
);

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      'a4400000-0000-4000-8000-000000000003',
      'Test Customer', 'CUSTOMER@example.test', '',
      'Please send me a quote.'
    )
  $$,
  'Retrying the same submission succeeds'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)
    FROM public.leads
    WHERE source_form_id = 'a4400000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'A retry does not create a duplicate lead'
);

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      'a4400000-0000-4000-8000-000000000003',
      'Test Customer', 'customer@example.test', '',
      'A different message.'
    )
  $$,
  '22023',
  'Submission ID was already used for another message',
  'A submission ID cannot be reused with changed content'
);

SELECT throws_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      gen_random_uuid(),
      'Test Customer', 'invalid-email', '',
      'Please send me a quote.'
    )
  $$,
  '22023',
  'Enter a valid email address',
  'Invalid email addresses are rejected'
);

RESET ROLE;

-- Existing receipt plus 19 fixtures reaches the hourly limit.
INSERT INTO private.public_lead_submission_receipts (
  form_id, submission_id, payload_hash
)
SELECT
  'a4400000-0000-4000-8000-000000000002'::uuid,
  gen_random_uuid(),
  repeat('0', 32)
FROM generate_series(1, 19);

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      gen_random_uuid(),
      'Another Customer', 'another@example.test', '',
      'Please contact me.'
    )
  $$,
  'P0001',
  'Contact form submission limit reached',
  'The hourly form limit is enforced'
);

RESET ROLE;

-- Clear rate fixtures to independently exercise subscription rejection.
DELETE FROM private.public_lead_submission_receipts
WHERE form_id = 'a4400000-0000-4000-8000-000000000002';

UPDATE public.organization_subscriptions
SET status = 'canceled'
WHERE organization_id = 'a4400000-0000-4000-8000-000000000001';

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$
    SELECT public.submit_public_lead(
      'a4400000-0000-4000-8000-000000000002',
      gen_random_uuid(),
      'Another Customer', 'another@example.test', '',
      'Please contact me.'
    )
  $$,
  'P0001',
  'Organization subscription is not active',
  'Public submissions respect the existing subscription trigger'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)
    FROM private.public_lead_submission_receipts
    WHERE form_id = 'a4400000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'A rejected lead does not leave a successful submission receipt'
);

SELECT * FROM finish();

ROLLBACK;