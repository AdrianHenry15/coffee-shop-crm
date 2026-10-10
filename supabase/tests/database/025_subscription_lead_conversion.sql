
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- =========================================================
-- Setup
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values (
  '00000000-0000-4000-8000-000000002501',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'subscription-conversion@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000002511',
  'Subscription Conversion Test',
  'subscription-conversion-test-025'
);

insert into public.organization_members (
  organization_id, user_id, role, status
)
values (
  '00000000-0000-4000-8000-000000002511',
  '00000000-0000-4000-8000-000000002501',
  'owner',
  'active'
);

-- Begin with 24 existing customers.
insert into public.customers (organization_id, name)
select
  '00000000-0000-4000-8000-000000002511',
  'Existing Customer ' || number
from generate_series(1, 24) as number;

-- Create two leads for conversion.
insert into public.leads (
  id, organization_id, name, status
)
values
(
  '00000000-0000-4000-8000-000000002521',
  '00000000-0000-4000-8000-000000002511',
  'Conversion Lead A',
  'qualified'
),
(
  '00000000-0000-4000-8000-000000002522',
  '00000000-0000-4000-8000-000000002511',
  'Conversion Lead B',
  'qualified'
);

-- Execute the RPC as an authenticated organization member.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002501',
  true
);

-- =========================================================
-- Free plan: conversion at the limit
-- =========================================================

-- Test 1: Conversion succeeds with one customer slot left.
select lives_ok(
  $$
    select public.convert_lead_to_customer(
      '00000000-0000-4000-8000-000000002521'
    )
  $$,
  'Free allows conversion when one customer slot remains'
);

-- Test 2: Conversion fills the final available slot.
select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000002511'
  ),
  25,
  'Successful conversion reaches the Free customer limit'
);

-- Test 3: Another conversion is rejected.
select throws_ok(
  $$
    select public.convert_lead_to_customer(
      '00000000-0000-4000-8000-000000002522'
    )
  $$,
  'P0001',
  'Subscription limit reached for customers',
  'Free rejects conversion beyond the customer limit'
);

-- Test 4: Rejected conversion creates no customer.
select is(
  (
    select count(*)::integer
    from public.customers
    where lead_id =
      '00000000-0000-4000-8000-000000002522'
  ),
  0,
  'Rejected conversion creates no customer'
);

-- Test 5: Original lead remains unchanged.
select is(
  (
    select status
    from public.leads
    where id =
      '00000000-0000-4000-8000-000000002522'
  ),
  'qualified',
  'Rejected conversion preserves the original lead status'
);

-- Test 6: Failed conversion does not change customer usage.
select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000002511'
  ),
  25,
  'Failed conversion does not increase customer usage'
);

-- =========================================================
-- Upgrade to Starter
-- =========================================================

set local role postgres;

update public.organization_subscriptions
set plan_id = 'starter'
where organization_id =
  '00000000-0000-4000-8000-000000002511';

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002501',
  true
);

-- Test 7: Conversion succeeds after upgrading.
select lives_ok(
  $$
    select public.convert_lead_to_customer(
      '00000000-0000-4000-8000-000000002522'
    )
  $$,
  'Starter allows conversion after the upgrade'
);

-- Test 8: Customer is linked to the converted lead.
select is(
  (
    select count(*)::integer
    from public.customers
    where lead_id =
      '00000000-0000-4000-8000-000000002522'
  ),
  1,
  'Successful conversion creates one linked customer'
);

-- Test 9: Total customer usage increases exactly once.
select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000002511'
  ),
  26,
  'Starter conversion increases customer usage to 26'
);

select * from finish();

rollback;
