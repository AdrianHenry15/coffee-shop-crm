
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- ============================================================
-- Fixtures
-- ============================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000000071',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'conversion-a@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000000072',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'conversion-b@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values
(
  '10000000-0000-4000-8000-000000000071',
  'Conversion Organization A',
  'conversion-org-a-test'
),
(
  '10000000-0000-4000-8000-000000000072',
  'Conversion Organization B',
  'conversion-org-b-test'
);

insert into public.organization_members (
  organization_id, user_id, role, status
)
values
(
  '10000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000071',
  'owner',
  'active'
),
(
  '10000000-0000-4000-8000-000000000072',
  '00000000-0000-4000-8000-000000000072',
  'owner',
  'active'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000071',
  true
);

insert into public.leads (
  id, organization_id, name, email, phone, status
)
values
(
  '20000000-0000-4000-8000-000000000071',
  '10000000-0000-4000-8000-000000000071',
  'Jane Smith',
  'jane@example.com',
  '555-1234',
  'qualified'
),
(
  '20000000-0000-4000-8000-000000000072',
  '10000000-0000-4000-8000-000000000071',
  'Lost Lead',
  null,
  null,
  'lost'
);

-- ============================================================
-- Test 1: Conversion succeeds
-- ============================================================

select lives_ok(
  $$
    select public.convert_lead_to_customer(
      '20000000-0000-4000-8000-000000000071'
    )
  $$,
  'Qualified lead can be converted'
);

-- ============================================================
-- Test 2: Customer created
-- ============================================================

select is(
  (
    select count(*)::integer
    from public.customers
    where lead_id = '20000000-0000-4000-8000-000000000071'
  ),
  1,
  'Exactly one customer was created'
);

-- ============================================================
-- Test 3: Name copied
-- ============================================================

select is(
  (
    select name
    from public.customers
    where lead_id = '20000000-0000-4000-8000-000000000071'
  ),
  'Jane Smith',
  'Customer name copied from lead'
);

-- ============================================================
-- Test 4: Email copied
-- ============================================================

select is(
  (
    select email
    from public.customers
    where lead_id = '20000000-0000-4000-8000-000000000071'
  ),
  'jane@example.com',
  'Customer email copied from lead'
);

-- ============================================================
-- Test 5: Original lead preserved
-- ============================================================

select is(
  (
    select count(*)::integer
    from public.leads
    where id = '20000000-0000-4000-8000-000000000071'
  ),
  1,
  'Original lead remains in database'
);

-- ============================================================
-- Test 6: Duplicate conversion rejected
-- ============================================================

select throws_ok(
  $$
    select public.convert_lead_to_customer(
      '20000000-0000-4000-8000-000000000071'
    )
  $$,
  '23505',
  'Lead has already been converted',
  'Duplicate conversion is rejected'
);

-- ============================================================
-- Test 7: Lost lead rejected
-- ============================================================

select throws_ok(
  $$
    select public.convert_lead_to_customer(
      '20000000-0000-4000-8000-000000000072'
    )
  $$,
  '23514',
  'Lost leads cannot be converted',
  'Lost lead conversion is rejected'
);

-- ============================================================
-- Test 8: Other organization cannot convert
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000072',
  true
);

select throws_ok(
  $$
    select public.convert_lead_to_customer(
      '20000000-0000-4000-8000-000000000071'
    )
  $$,
  'P0002',
  'Lead not found or access denied',
  'Cross-organization conversion is rejected'
);

select * from finish();

rollback;
