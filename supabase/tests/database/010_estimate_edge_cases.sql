
begin;

set local search_path = public, extensions;

select plan(10);

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
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'edge-a@example.com',
  '',
  now(),
  now(),
  now()
),
(
  '00000000-0000-4000-8000-000000001002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'edge-b@example.com',
  '',
  now(),
  now(),
  now()
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000001011',
  'Edge Test A',
  'edge-test-a-010'
),
(
  '00000000-0000-4000-8000-000000001012',
  'Edge Test B',
  'edge-test-b-010'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values
(
  '00000000-0000-4000-8000-000000001011',
  '00000000-0000-4000-8000-000000001001',
  'owner'
),
(
  '00000000-0000-4000-8000-000000001012',
  '00000000-0000-4000-8000-000000001002',
  'owner'
);

insert into public.customers (
  id,
  organization_id,
  name
)
values
(
  '00000000-0000-4000-8000-000000001021',
  '00000000-0000-4000-8000-000000001011',
  'Edge Customer A'
),
(
  '00000000-0000-4000-8000-000000001022',
  '00000000-0000-4000-8000-000000001012',
  'Edge Customer B'
);

insert into public.estimates (
  id,
  organization_id,
  customer_id,
  status
)
values
(
  '00000000-0000-4000-8000-000000001031',
  '00000000-0000-4000-8000-000000001011',
  '00000000-0000-4000-8000-000000001021',
  'draft'
),
(
  '00000000-0000-4000-8000-000000001032',
  '00000000-0000-4000-8000-000000001012',
  '00000000-0000-4000-8000-000000001022',
  'draft'
),
(
  '00000000-0000-4000-8000-000000001033',
  '00000000-0000-4000-8000-000000001011',
  '00000000-0000-4000-8000-000000001021',
  'draft'
);

insert into public.estimate_items (
  id,
  organization_id,
  estimate_id,
  description,
  quantity,
  unit_price_cents
)
values
(
  '00000000-0000-4000-8000-000000001041',
  '00000000-0000-4000-8000-000000001011',
  '00000000-0000-4000-8000-000000001031',
  'Original Draft Item',
  1,
  10000
),
(
  '00000000-0000-4000-8000-000000001042',
  '00000000-0000-4000-8000-000000001012',
  '00000000-0000-4000-8000-000000001032',
  'Organization B Item',
  1,
  20000
),
(
  '00000000-0000-4000-8000-000000001043',
  '00000000-0000-4000-8000-000000001011',
  '00000000-0000-4000-8000-000000001033',
  'Sent Estimate Item',
  1,
  15000
);

-- Authenticate as User A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001001',
  true
);

-- =========================================================
-- TENANT ISOLATION
-- =========================================================

-- Test 1: Cannot edit another organization's estimate.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000001012',
      '00000000-0000-4000-8000-000000001032',
      '[{"description":"Unauthorized","quantity":1,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 2: Organization B item remains unchanged.
reset role;

select is(
  (
    select description
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001042'
  ),
  'Organization B Item',
  'Cross-organization update did not modify data'
);

update public.estimates
set status = 'sent'
where id = '00000000-0000-4000-8000-000000001033';

-- Return to User A.
set local role authenticated;

-- Test 3: Cannot target another organization's estimate
-- while providing Organization A's ID.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000001011',
      '00000000-0000-4000-8000-000000001032',
      '[{"description":"Unauthorized","quantity":1,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- =========================================================
-- STATUS RESTRICTIONS
-- =========================================================

-- Test 4: Cannot edit a sent estimate.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000001011',
      '00000000-0000-4000-8000-000000001033',
      '[{"description":"Modified","quantity":1,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 5: Sent estimate item remains unchanged.
select is(
  (
    select description
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001043'
  ),
  'Sent Estimate Item',
  'Sent estimate items remain unchanged'
);

-- =========================================================
-- VALIDATION AND ROLLBACK
-- =========================================================

-- Test 6: Reject an empty items array.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000001011',
      '00000000-0000-4000-8000-000000001031',
      '[]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 7: Reject invalid quantity.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000001011',
      '00000000-0000-4000-8000-000000001031',
      '[{"description":"Invalid","quantity":0,"unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 8: Existing item survives rejected updates.
select is(
  (
    select description
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001041'
  ),
  'Original Draft Item',
  'Rejected updates preserve existing items'
);

-- Test 9: Reject malformed item data.
select throws_ok(
  $$
    select public.update_estimate_items(
      '00000000-0000-4000-8000-000000001011',
      '00000000-0000-4000-8000-000000001031',
      '[{"description":"Invalid","quantity":"abc","unitPriceCents":100}]'::jsonb
    )
  $$,
  'P0001'
);

-- Test 10: Draft item count remains unchanged.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where estimate_id =
      '00000000-0000-4000-8000-000000001031'
  ),
  1,
  'Failed updates do not change item count'
);

select * from finish();

rollback;
