
begin;

select plan(14);

set local search_path = public, extensions;

-- =========================================================
-- SETUP
-- =========================================================

-- Create two test users.
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
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'estimate-a@example.com',
  '',
  now(),
  now(),
  now()
),
(
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'estimate-b@example.com',
  '',
  now(),
  now(),
  now()
);

-- Create two organizations.
insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000000811',
  'Estimate Test A',
  'estimate-test-a-008'
),
(
  '00000000-0000-4000-8000-000000000812',
  'Estimate Test B',
  'estimate-test-b-008'
);

-- Add organization members.
insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values
(
  '00000000-0000-4000-8000-000000000811',
  '00000000-0000-4000-8000-000000000801',
  'owner'
),
(
  '00000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000802',
  'owner'
);

-- Create customers.
insert into public.customers (
  id,
  organization_id,
  name
)
values
(
  '00000000-0000-4000-8000-000000000821',
  '00000000-0000-4000-8000-000000000811',
  'Customer A'
),
(
  '00000000-0000-4000-8000-000000000822',
  '00000000-0000-4000-8000-000000000812',
  'Customer B'
);

-- Create estimates.
insert into public.estimates (
  id,
  organization_id,
  customer_id
)
values
(
  '00000000-0000-4000-8000-000000000831',
  '00000000-0000-4000-8000-000000000811',
  '00000000-0000-4000-8000-000000000821'
),
(
  '00000000-0000-4000-8000-000000000832',
  '00000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000822'
);

-- Create estimate items.
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
  '00000000-0000-4000-8000-000000000841',
  '00000000-0000-4000-8000-000000000811',
  '00000000-0000-4000-8000-000000000831',
  'Service A',
  2,
  12500
),
(
  '00000000-0000-4000-8000-000000000842',
  '00000000-0000-4000-8000-000000000812',
  '00000000-0000-4000-8000-000000000832',
  'Service B',
  1,
  20000
);

-- =========================================================
-- TENANT ISOLATION TESTS
-- =========================================================

-- Authenticate as User A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000801',
  true
);

-- Test 1: User A sees only their organization's estimates.
select is(
  (select count(*)::integer from public.estimates),
  1,
  'User A sees only their organization estimates'
);

-- Test 2: User A sees only their organization's items.
select is(
  (select count(*)::integer from public.estimate_items),
  1,
  'User A sees only their organization estimate items'
);

-- Test 3: User A cannot read Organization B estimates.
select is(
  (
    select count(*)::integer
    from public.estimates
    where organization_id =
      '00000000-0000-4000-8000-000000000812'
  ),
  0,
  'User A cannot read Organization B estimates'
);

-- Test 4: User A cannot read Organization B items.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where organization_id =
      '00000000-0000-4000-8000-000000000812'
  ),
  0,
  'User A cannot read Organization B estimate items'
);

-- Test 5: User A cannot update Organization B estimates.
with attempted as (
  update public.estimates
  set notes = 'Unauthorized edit'
  where id = '00000000-0000-4000-8000-000000000832'
  returning id
)
select is(
  (select count(*)::integer from attempted),
  0,
  'User A cannot update Organization B estimates'
);

-- Test 6: User A cannot delete Organization B items.
with attempted as (
  delete from public.estimate_items
  where id = '00000000-0000-4000-8000-000000000842'
  returning id
)
select is(
  (select count(*)::integer from attempted),
  0,
  'User A cannot delete Organization B estimate items'
);

-- Restore test runner privileges.
reset role;

-- =========================================================
-- DATABASE CONSTRAINT TESTS
-- =========================================================

-- Test 7: Cross-organization customer reference.
select throws_ok(
  $$
    insert into public.estimates (
      organization_id,
      customer_id
    )
    values (
      '00000000-0000-4000-8000-000000000811',
      '00000000-0000-4000-8000-000000000822'
    )
  $$,
  '23503'
);

-- Test 8: Cross-organization estimate item reference.
select throws_ok(
  $$
    insert into public.estimate_items (
      organization_id,
      estimate_id,
      description
    )
    values (
      '00000000-0000-4000-8000-000000000811',
      '00000000-0000-4000-8000-000000000832',
      'Invalid cross-org item'
    )
  $$,
  '23503'
);

-- Test 9: Quantity cannot be zero.
select throws_ok(
  $$
    insert into public.estimate_items (
      organization_id,
      estimate_id,
      description,
      quantity
    )
    values (
      '00000000-0000-4000-8000-000000000811',
      '00000000-0000-4000-8000-000000000831',
      'Invalid quantity',
      0
    )
  $$,
  '23514'
);

-- Test 10: Price cannot be negative.
select throws_ok(
  $$
    insert into public.estimate_items (
      organization_id,
      estimate_id,
      description,
      unit_price_cents
    )
    values (
      '00000000-0000-4000-8000-000000000811',
      '00000000-0000-4000-8000-000000000831',
      'Invalid price',
      -100
    )
  $$,
  '23514'
);

-- Test 11: Invalid estimate status.
select throws_ok(
  $$
    update public.estimates
    set status = 'completed'
    where id = '00000000-0000-4000-8000-000000000831'
  $$,
  '23514'
);

-- Test 12: Estimate organization cannot change.
select throws_ok(
  $$
    update public.estimates
    set organization_id =
      '00000000-0000-4000-8000-000000000812'
    where id = '00000000-0000-4000-8000-000000000831'
  $$,
  '23514'
);

-- Test 13: Estimate item parent cannot change.
select throws_ok(
  $$
    update public.estimate_items
    set estimate_id =
      '00000000-0000-4000-8000-000000000832'
    where id = '00000000-0000-4000-8000-000000000841'
  $$,
  '23514'
);

-- Test 14: Line item total calculation.
select is(
  (
    select quantity::bigint * unit_price_cents
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000000841'
  ),
  25000::bigint,
  'Line item total calculates correctly in cents'
);

-- =========================================================
-- FINISH
-- =========================================================

select * from finish();

rollback;
