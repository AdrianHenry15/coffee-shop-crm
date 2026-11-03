BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT no_plan();

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_other_org uuid := gen_random_uuid();

  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();

  v_customer uuid := gen_random_uuid();
  v_other_customer uuid := gen_random_uuid();

  v_estimate uuid := gen_random_uuid();
  v_foreign_estimate uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  )
  SELECT
    fixture.id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    fixture.id::text || '@test.local',
    '',
    now(),
    now(),
    now()
  FROM unnest(
    ARRAY[v_owner, v_admin, v_member, v_outsider]
  ) AS fixture(id);

  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (v_org, 'Estimate Permissions', 'estimate-perm-' || v_org::text),
    (
      v_other_org,
      'Other Estimate Permissions',
      'estimate-perm-' || v_other_org::text
    );

  UPDATE public.organization_subscriptions
  SET plan_id = 'pro', status = 'active'
  WHERE organization_id IN (v_org, v_other_org);

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status
  )
  VALUES
    (v_org, v_owner, 'owner', 'active'),
    (v_org, v_admin, 'admin', 'active'),
    (v_org, v_member, 'member', 'active'),
    (v_other_org, v_outsider, 'owner', 'active');

  INSERT INTO public.customers (id, organization_id, name)
  VALUES
    (v_customer, v_org, 'Estimate Customer'),
    (v_other_customer, v_other_org, 'Foreign Estimate Customer');

  INSERT INTO public.estimates (
    id, organization_id, customer_id, notes
  )
  VALUES
    (v_estimate, v_org, v_customer, 'Original notes'),
    (
      v_foreign_estimate,
      v_other_org,
      v_other_customer,
      'Foreign notes'
    );

  INSERT INTO public.estimate_items (
    organization_id,
    estimate_id,
    description,
    quantity,
    unit_price_cents
  )
  VALUES
    (v_org, v_estimate, 'Original service', 1, 1000),
    (v_other_org, v_foreign_estimate, 'Foreign service', 1, 2000);

  PERFORM set_config('test.est_org', v_org::text, true);
  PERFORM set_config('test.est_other_org', v_other_org::text, true);
  PERFORM set_config('test.est_owner', v_owner::text, true);
  PERFORM set_config('test.est_admin', v_admin::text, true);
  PERFORM set_config('test.est_member', v_member::text, true);
  PERFORM set_config('test.est_outsider', v_outsider::text, true);
  PERFORM set_config('test.est_customer', v_customer::text, true);
  PERFORM set_config('test.est_record', v_estimate::text, true);
  PERFORM set_config(
    'test.est_foreign_record', v_foreign_estimate::text, true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.est_member'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.estimates),
  1::bigint,
  'Members can read estimates only in their workspace'
);

SELECT is(
  (SELECT count(*) FROM public.estimate_items),
  1::bigint,
  'Members can read their workspace estimate items'
);

SELECT throws_ok(
  $$
    SELECT public.create_estimate(
      p_organization_id := current_setting('test.est_org')::uuid,
      p_customer_id := current_setting('test.est_customer')::uuid,
      p_notes := 'Unauthorized estimate',
      p_items := '[
        {
          "description": "Unauthorized service",
          "quantity": 1,
          "unitPriceCents": 500
        }
      ]'::jsonb
    )
  $$,
  NULL, NULL,
  'Members cannot create estimates through the RPC'
);

SELECT is(
  (SELECT count(*) FROM public.estimates),
  1::bigint,
  'Rejected creation leaves no additional estimate'
);

WITH changed AS (
  UPDATE public.estimates
  SET notes = 'Unauthorized notes'
  WHERE id = current_setting('test.est_record')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Members cannot directly edit estimate notes'
);

WITH changed AS (
  UPDATE public.estimates
  SET status = 'sent'
  WHERE id = current_setting('test.est_record')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Members cannot directly change estimate status'
);

SELECT throws_ok(
  $$
    SELECT public.update_estimate_items(
      p_organization_id := current_setting('test.est_org')::uuid,
      p_estimate_id := current_setting('test.est_record')::uuid,
      p_items := '[
        {
          "description": "Unauthorized replacement",
          "quantity": 2,
          "unitPriceCents": 9000
        }
      ]'::jsonb
    )
  $$,
  NULL, NULL,
  'Members cannot replace estimate items through the RPC'
);

SELECT is(
  (
    SELECT description
    FROM public.estimate_items
    WHERE estimate_id = current_setting('test.est_record')::uuid
  ),
  'Original service',
  'Rejected item replacement preserves the original service'
);

SELECT throws_ok(
  $$
    SELECT public.delete_estimate(
      current_setting('test.est_org')::uuid,
      current_setting('test.est_record')::uuid
    )
  $$,
  NULL, NULL,
  'Members cannot delete estimates through the privileged RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.estimates
    WHERE id = current_setting('test.est_record')::uuid
  ),
  'Rejected RPC deletion preserves the estimate'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.estimate_items
    WHERE estimate_id = current_setting('test.est_record')::uuid
  ),
  1::bigint,
  'Rejected RPC deletion preserves its items'
);

-- A different workspace owner cannot delete this estimate.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.est_outsider'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.delete_estimate(
      current_setting('test.est_org')::uuid,
      current_setting('test.est_record')::uuid
    )
  $$,
  NULL, NULL,
  'Ownership of another workspace does not permit deletion'
);

-- Admins retain estimate-management access.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.est_admin'),
  true
);

SELECT lives_ok(
  $$
    SELECT public.update_estimate_items(
      p_organization_id := current_setting('test.est_org')::uuid,
      p_estimate_id := current_setting('test.est_record')::uuid,
      p_items := '[
        {
          "description": "Admin replacement",
          "quantity": 2,
          "unitPriceCents": 1500
        }
      ]'::jsonb
    )
  $$,
  'Admins can replace draft estimate items'
);

SELECT is(
  (
    SELECT description
    FROM public.estimate_items
    WHERE estimate_id = current_setting('test.est_record')::uuid
  ),
  'Admin replacement',
  'Authorized item replacement is saved'
);

SELECT lives_ok(
  $$
    SELECT public.create_estimate(
      p_organization_id := current_setting('test.est_org')::uuid,
      p_customer_id := current_setting('test.est_customer')::uuid,
      p_notes := 'Admin created estimate',
      p_items := '[
        {
          "description": "Admin service",
          "quantity": 1,
          "unitPriceCents": 500
        }
      ]'::jsonb
    )
  $$,
  'Admins can create estimates through the RPC'
);

-- Finalize the original estimate before testing deletion.
UPDATE public.estimates
SET status = 'sent'
WHERE id = current_setting('test.est_record')::uuid;

UPDATE public.estimates
SET status = 'accepted'
WHERE id = current_setting('test.est_record')::uuid;

SELECT lives_ok(
  $$
    SELECT public.delete_estimate(
      current_setting('test.est_org')::uuid,
      current_setting('test.est_record')::uuid
    )
  $$,
  'Admins can delete finalized estimates through the RPC'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.estimates
    WHERE id = current_setting('test.est_record')::uuid
  ),
  'Authorized deletion removes the estimate'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.estimate_items
    WHERE estimate_id = current_setting('test.est_record')::uuid
  ),
  0::bigint,
  'Authorized deletion removes associated items'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.estimates
    WHERE id = current_setting('test.est_foreign_record')::uuid
  ),
  'The other workspace estimate remains intact'
);

SELECT * FROM finish();
ROLLBACK;