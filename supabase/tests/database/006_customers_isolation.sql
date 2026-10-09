
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- ============================================================
-- Helper: Count rows affected by a mutation
-- ============================================================

create function pg_temp.affected_rows(command text)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  execute command;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ============================================================
-- Fixtures
-- ============================================================

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000000061',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'customer-a@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000000062',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'customer-b@test.local',
  ''
);

insert into public.organizations (
  id,
  name,
  slug
)
values
(
  '10000000-0000-4000-8000-000000000061',
  'Customer Organization A',
  'customer-org-a-test'
),
(
  '10000000-0000-4000-8000-000000000062',
  'Customer Organization B',
  'customer-org-b-test'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status
)
values
(
  '10000000-0000-4000-8000-000000000061',
  '00000000-0000-4000-8000-000000000061',
  'owner',
  'active'
),
(
  '10000000-0000-4000-8000-000000000062',
  '00000000-0000-4000-8000-000000000062',
  'owner',
  'active'
);

-- ============================================================
-- Authenticate as User A
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000061',
  true
);

-- Create a lead belonging to Organization A.

insert into public.leads (
  id,
  organization_id,
  name
)
values (
  '20000000-0000-4000-8000-000000000061',
  '10000000-0000-4000-8000-000000000061',
  'Original Lead'
);

-- ============================================================
-- Test 1: A can create a customer
-- ============================================================

select lives_ok(
  $$
    insert into public.customers (
      id,
      organization_id,
      lead_id,
      name
    )
    values (
      '30000000-0000-4000-8000-000000000061',
      '10000000-0000-4000-8000-000000000061',
      '20000000-0000-4000-8000-000000000061',
      'Customer A'
    )
  $$,
  'A can create a customer'
);

-- ============================================================
-- Test 2: A can read its customer
-- ============================================================

select is(
  (
    select name
    from public.customers
    where id = '30000000-0000-4000-8000-000000000061'
  ),
  'Customer A',
  'A can read its customer'
);

-- ============================================================
-- Test 3: A can update its customer
-- ============================================================

select is(
  pg_temp.affected_rows(
    $$
      update public.customers
      set status = 'inactive'
      where id = '30000000-0000-4000-8000-000000000061'
    $$
  ),
  1,
  'A can update its customer'
);

-- ============================================================
-- Authenticate as User B
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000062',
  true
);

-- ============================================================
-- Test 4: B cannot read A's customer
-- ============================================================

select is(
  (
    select count(*)::integer
    from public.customers
    where id = '30000000-0000-4000-8000-000000000061'
  ),
  0,
  'B cannot read A customer'
);

-- ============================================================
-- Test 5: B cannot update A's customer
-- ============================================================

select is(
  pg_temp.affected_rows(
    $$
      update public.customers
      set name = 'Unauthorized Update'
      where id = '30000000-0000-4000-8000-000000000061'
    $$
  ),
  0,
  'B cannot update A customer'
);

-- ============================================================
-- Test 6: B cannot delete A's customer
-- ============================================================

select is(
  pg_temp.affected_rows(
    $$
      delete from public.customers
      where id = '30000000-0000-4000-8000-000000000061'
    $$
  ),
  0,
  'B cannot delete A customer'
);

-- ============================================================
-- Test 7: B can create its own customer
-- ============================================================

select lives_ok(
  $$
    insert into public.customers (
      id,
      organization_id,
      name
    )
    values (
      '30000000-0000-4000-8000-000000000062',
      '10000000-0000-4000-8000-000000000062',
      'Customer B'
    )
  $$,
  'B can create its own customer'
);

-- ============================================================
-- Test 8: B cannot reference A's lead
-- ============================================================

select throws_ok(
  $$
    insert into public.customers (
      organization_id,
      lead_id,
      name
    )
    values (
      '10000000-0000-4000-8000-000000000062',
      '20000000-0000-4000-8000-000000000061',
      'Invalid Cross-Org Customer'
    )
  $$,
  '23503',
  'insert or update on table "customers" violates foreign key constraint "customers_lead_same_organization"',
  'Cross-organization lead reference is rejected'
);

-- ============================================================
-- Authenticate as User A again
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000061',
  true
);

-- ============================================================
-- Test 9: Same lead cannot be converted twice
-- ============================================================

select throws_ok(
  $$
    insert into public.customers (
      organization_id,
      lead_id,
      name
    )
    values (
      '10000000-0000-4000-8000-000000000061',
      '20000000-0000-4000-8000-000000000061',
      'Duplicate Conversion'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "customers_organization_lead_unique"',
  'Same lead cannot create multiple customers'
);

-- ============================================================
-- Add User A to Organization B
-- ============================================================

reset role;

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status
)
values (
  '10000000-0000-4000-8000-000000000062',
  '00000000-0000-4000-8000-000000000061',
  'member',
  'active'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000061',
  true
);

-- ============================================================
-- Test 10: Customer ownership cannot change
-- ============================================================

select throws_ok(
  $$
    update public.customers
    set organization_id =
      '10000000-0000-4000-8000-000000000062'
    where id = '30000000-0000-4000-8000-000000000061'
  $$,
  '23514',
  'Customer organization cannot be changed',
  'Customer ownership is immutable'
);

-- ============================================================
-- Test 11: Normal updates still work
-- ============================================================

select is(
  pg_temp.affected_rows(
    $$
      update public.customers
      set name = 'Updated Customer A'
      where id = '30000000-0000-4000-8000-000000000061'
    $$
  ),
  1,
  'Normal customer updates remain allowed'
);

-- ============================================================
-- Test 12: Anonymous users cannot view customers
-- ============================================================

set local role anon;

select set_config(
  'request.jwt.claim.sub',
  '',
  true
);

select is(
  (
    select count(*)::integer
    from public.customers
  ),
  0,
  'Anonymous users cannot view customers'
);

-- ============================================================
-- Finish
-- ============================================================

select * from finish();

rollback;
