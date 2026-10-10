
begin;

-- ============================================================
-- Test setup
-- ============================================================

-- pgTAP provides PostgreSQL testing assertions.
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Create two fake authenticated users.
-- These are test identities, not production accounts.

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
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'user-a@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'user-b@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values
(
  '10000000-0000-4000-8000-000000000001',
  'Test Organization A',
  'test-organization-a'
),
(
  '10000000-0000-4000-8000-000000000002',
  'Test Organization B',
  'test-organization-b'
);

-- Keep this test focused on RLS, not subscription limits.
update public.organization_subscriptions
set plan_id = 'pro'
where organization_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values
(
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'owner'
),
(
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  'owner'
);

-- ============================================================
-- Simulate User A
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*) from public.organizations
   where slug = 'test-organization-a'),
  1::bigint,
  'User A can read Organization A'
);

select is(
  (select count(*) from public.organizations
   where slug = 'test-organization-b'),
  0::bigint,
  'User A cannot read Organization B'
);

select is(
  (select count(*) from public.organization_members
   where organization_id =
     '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'User A can read their organization membership'
);

select is(
  (select count(*) from public.organization_members
   where organization_id =
     '10000000-0000-4000-8000-000000000002'),
  0::bigint,
  'User A cannot read Organization B memberships'
);

select throws_ok(
  $$
    insert into public.organization_members (
      organization_id, user_id, role
    )
    values (
      '10000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      'owner'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "organization_members"',
  'User A cannot insert unauthorized memberships'
);

select lives_ok(
  $$
    update public.organization_members
    set role = 'admin'
    where user_id =
      '00000000-0000-4000-8000-000000000001'
  $$,
  'User A cannot modify membership roles'
);

select is(
  (
    select role
    from public.organization_members
    where user_id =
      '00000000-0000-4000-8000-000000000001'
  ),
  'owner',
  'User A membership role remains unchanged'
);

-- ============================================================
-- Simulate User B
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);

select is(
  (select count(*) from public.organizations
   where slug = 'test-organization-a'),
  0::bigint,
  'User B cannot read Organization A'
);

-- ============================================================
-- Simulate anonymous access
-- ============================================================

reset role;
set local role anon;

select is(
  (select count(*) from public.organizations),
  0::bigint,
  'Anonymous users cannot read organizations'
);

select * from finish();

rollback;
