
begin;

set local search_path = public, extensions;

select plan(12);

-- =========================================================
-- SETUP
-- =========================================================

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
(
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'atomic-a@example.com',
  '',
  now(),
  now(),
  now()
),
(
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'atomic-b@example.com',
  '',
  now(),
  now(),
  now()
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000000911',
  'Atomic Test A',
  'atomic-test-a-009'
),
(
  '00000000-0000-4000-8000-000000000912',
  'Atomic Test B',
  'atomic-test-b-009'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values
(
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000901',
  'owner'
),
(
  '00000000-0000-4000-8000-000000000912',
  '00000000-0000-4000-8000-000000000902',
  'owner'
);

insert into public.customers (
  id,
  organization_id,
  name
)
values
(
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000911',
  'Atomic Customer A'
),
(
  '00000000-0000-4000-8000-000000000922',
  '00000000-0000-4000-8000-000000000912',
  'Atomic Customer B'
);

-- Authenticate as User A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000901',
  true
);

-- =========================================================
-- CREATE ESTIMATE TESTS
-- =========================================================

-- Test 1: Authorized user can create an estimate.
select lives_ok(
  $$
    select public.create_estimate(
      '00000000-0000-4000-8000-000000000911',
      '00000000-0000-4000-8000-000000000921',
      'Test estimate',
      '[
        {
          "description": "Exterior Cleaning",
          "quantity": 2,
          "unitPriceCents": 12500
        },
        {
          "description": "Driveway Cleaning",
          "quantity": 1,
          "unitPriceCents": 7500
        }
      ]'::jsonb
    )
  $$,
  'Authorized user can create an estimate'
);

-- Test 2: Estimate was saved.
select is(
  (
    select count(*)::integer
    from public.estimates
    where organization_id =
      '00000000-0000-4000-8000-000000000911'
  ),
  1,
  'Estimate was created successfully'
);

-- Test 3: Both line items were saved.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where organization_id =
      '00000000-0000-4000-8000-000000000911'
  ),
  2,
  'Both estimate items were created'
);

-- Test 4: Total is correct.
select is(
  (
    select sum(quantity::bigint * unit_price_cents)
    from public.estimate_items
    where organization_id =
      '00000000-0000-4000-8000-000000000911'
  ),
  32500::numeric,
  'Estimate total is $325.00'
);

-- Test 5: User A cannot create an estimate for Organization B.
select throws_ok(
  $$
    select public.create_estimate(
      '00000000-0000-4000-8000-000000000912',
      '00000000-0000-4000-8000-000000000922',
      null,
      '[{"description":"Unauthorized","quantity":1,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 6: User A cannot use Organization B customer.
select throws_ok(
  $$
    select public.create_estimate(
      '00000000-0000-4000-8000-000000000911',
      '00000000-0000-4000-8000-000000000922',
      null,
      '[{"description":"Invalid Customer","quantity":1,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 7: Invalid item rejects creation.
select throws_ok(
  $$
    select public.create_estimate(
      '00000000-0000-4000-8000-000000000911',
      '00000000-0000-4000-8000-000000000921',
      null,
      '[{"description":"Invalid","quantity":0,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 8: Failed creation left no extra estimate.
select is(
  (
    select count(*)::integer
    from public.estimates
    where organization_id =
      '00000000-0000-4000-8000-000000000911'
  ),
  1,
  'Failed creation does not save an estimate'
);

-- =========================================================
-- UPDATE ESTIMATE ITEMS TESTS
-- =========================================================

-- Test 9: Draft estimate items can be updated.
select lives_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000000911',
      (
        select id
        from public.estimates
        where organization_id =
          '00000000-0000-4000-8000-000000000911'
        limit 1
      ),
      '[{"description":"Updated Service","quantity":3,"unitPriceCents":5000}]'::jsonb
    )
  $$,
  'Draft estimate items can be updated'
);

-- Test 10: Items were replaced.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where organization_id =
      '00000000-0000-4000-8000-000000000911'
  ),
  1,
  'Existing items were replaced'
);

-- Test 11: Invalid update is rejected.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000000911',
      (
        select id
        from public.estimates
        where organization_id =
          '00000000-0000-4000-8000-000000000911'
        limit 1
      ),
      '[{"description":"Invalid","quantity":-1,"unitPriceCents":5000}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 12: Failed update preserves original items.
select is(
  (
    select description
    from public.estimate_items
    where organization_id =
      '00000000-0000-4000-8000-000000000911'
    limit 1
  ),
  'Updated Service',
  'Failed update preserves existing items'
);

select * from finish();

rollback;
