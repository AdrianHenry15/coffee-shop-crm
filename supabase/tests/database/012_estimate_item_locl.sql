
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
values (
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'estimate-lock@example.com',
  '',
  now(),
  now(),
  now()
);

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000001211',
  'Estimate Lock Test',
  'estimate-lock-test-012'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values (
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001201',
  'owner'
);

insert into public.customers (
  id,
  organization_id,
  name
)
values (
  '00000000-0000-4000-8000-000000001221',
  '00000000-0000-4000-8000-000000001211',
  'Lock Test Customer'
);

-- Create three draft estimates.
insert into public.estimates (
  id,
  organization_id,
  customer_id,
  status
)
values
(
  '00000000-0000-4000-8000-000000001231',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001221',
  'draft'
),
(
  '00000000-0000-4000-8000-000000001232',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001221',
  'draft'
),
(
  '00000000-0000-4000-8000-000000001233',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001221',
  'draft'
);

-- Populate items while estimates are drafts.
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
  '00000000-0000-4000-8000-000000001241',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001231',
  'Sent Item',
  1,
  10000
),
(
  '00000000-0000-4000-8000-000000001242',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001232',
  'Accepted Item',
  1,
  20000
),
(
  '00000000-0000-4000-8000-000000001243',
  '00000000-0000-4000-8000-000000001211',
  '00000000-0000-4000-8000-000000001233',
  'Declined Item',
  1,
  30000
);

-- First, move all three estimates from draft to sent.
update public.estimates
set status = 'sent'
where id in (
  '00000000-0000-4000-8000-000000001231',
  '00000000-0000-4000-8000-000000001232',
  '00000000-0000-4000-8000-000000001233'
);

-- Then finalize the accepted and declined estimates.
update public.estimates
set status = 'accepted'
where id = '00000000-0000-4000-8000-000000001232';

update public.estimates
set status = 'declined'
where id = '00000000-0000-4000-8000-000000001233';

-- Test as an authenticated organization member.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001201',
  true
);

-- =========================================================
-- SENT ESTIMATE
-- =========================================================

-- Test 1: Cannot insert.
select throws_ok(
  $$
    insert into public.estimate_items (
      organization_id, estimate_id, description
    )
    values (
      '00000000-0000-4000-8000-000000001211',
      '00000000-0000-4000-8000-000000001231',
      'Unauthorized Item'
    )
  $$,
  'P0001'
);

-- Test 2: Cannot update.
select throws_ok(
  $$
    update public.estimate_items
    set description = 'Changed'
    where id = '00000000-0000-4000-8000-000000001241'
  $$,
  'P0001'
);

-- Test 3: Cannot delete.
select throws_ok(
  $$
    delete from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001241'
  $$,
  'P0001'
);

-- =========================================================
-- ACCEPTED ESTIMATE
-- =========================================================

-- Test 4: Cannot insert.
select throws_ok(
  $$
    insert into public.estimate_items (
      organization_id, estimate_id, description
    )
    values (
      '00000000-0000-4000-8000-000000001211',
      '00000000-0000-4000-8000-000000001232',
      'Unauthorized Item'
    )
  $$,
  'P0001'
);

-- Test 5: Cannot update.
select throws_ok(
  $$
    update public.estimate_items
    set description = 'Changed'
    where id = '00000000-0000-4000-8000-000000001242'
  $$,
  'P0001'
);

-- Test 6: Cannot delete.
select throws_ok(
  $$
    delete from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001242'
  $$,
  'P0001'
);

-- =========================================================
-- DECLINED ESTIMATE
-- =========================================================

-- Test 7: Cannot insert.
select throws_ok(
  $$
    insert into public.estimate_items (
      organization_id, estimate_id, description
    )
    values (
      '00000000-0000-4000-8000-000000001211',
      '00000000-0000-4000-8000-000000001233',
      'Unauthorized Item'
    )
  $$,
  'P0001'
);

-- Test 8: Cannot update.
select throws_ok(
  $$
    update public.estimate_items
    set description = 'Changed'
    where id = '00000000-0000-4000-8000-000000001243'
  $$,
  'P0001'
);

-- Test 9: Cannot delete.
select throws_ok(
  $$
    delete from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001243'
  $$,
  'P0001'
);

-- =========================================================
-- DATA INTEGRITY
-- =========================================================

-- Test 10: Sent item unchanged.
select is(
  (
    select description
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001241'
  ),
  'Sent Item',
  'Sent estimate item remains unchanged'
);

-- Test 11: Accepted item unchanged.
select is(
  (
    select description
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001242'
  ),
  'Accepted Item',
  'Accepted estimate item remains unchanged'
);

-- Test 12: Declined item unchanged.
select is(
  (
    select description
    from public.estimate_items
    where id = '00000000-0000-4000-8000-000000001243'
  ),
  'Declined Item',
  'Declined estimate item remains unchanged'
);

select * from finish();

rollback;
