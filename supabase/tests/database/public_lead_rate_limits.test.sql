BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

RESET ROLE;

INSERT INTO public.organizations (id, name, slug)
VALUES (
  'a4500000-0000-4000-8000-000000000001',
  'Lead Rate Test',
  'public-lead-rate-test'
);

INSERT INTO public.organization_lead_forms (
  id, organization_id, enabled
)
VALUES (
  'a4500000-0000-4000-8000-000000000002',
  'a4500000-0000-4000-8000-000000000001',
  true
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.consume_public_lead_attempt(uuid,text)',
    'EXECUTE'
  ),
  'Anonymous clients cannot consume rate buckets directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.consume_public_lead_attempt(uuid,text)',
    'EXECUTE'
  ),
  'Authenticated browser clients cannot consume rate buckets directly'
);

SET LOCAL ROLE service_role;

SELECT is(
  public.consume_public_lead_attempt(
    'a4500000-0000-4000-8000-000000000002',
    repeat('a', 64)
  ),
  true,
  'The first visitor attempt is allowed'
);

-- Consume the remaining four attempts.
DO $$
BEGIN
  FOR attempt IN 1..4 LOOP
    PERFORM public.consume_public_lead_attempt(
      'a4500000-0000-4000-8000-000000000002',
      repeat('a', 64)
    );
  END LOOP;
END;
$$;

SELECT is(
  public.consume_public_lead_attempt(
    'a4500000-0000-4000-8000-000000000002',
    repeat('a', 64)
  ),
  false,
  'The sixth attempt in the same window is rejected'
);

SELECT is(
  public.consume_public_lead_attempt(
    'a4500000-0000-4000-8000-000000000002',
    repeat('b', 64)
  ),
  true,
  'A different visitor has a separate limit'
);

RESET ROLE;

UPDATE public.organization_lead_forms
SET enabled = false
WHERE id = 'a4500000-0000-4000-8000-000000000002';

SET LOCAL ROLE service_role;

SELECT is(
  public.consume_public_lead_attempt(
    'a4500000-0000-4000-8000-000000000002',
    repeat('c', 64)
  ),
  false,
  'Disabled forms reject attempts'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;