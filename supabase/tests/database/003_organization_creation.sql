
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- ============================================================
-- Fixtures
-- ============================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000000031',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'creator@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000000032',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'other@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values (
  '10000000-0000-4000-8000-000000000032',
  'Protected Organization',
  'protected-organization-test'
);

-- The signup trigger should create profiles automatically.

select ok(
  exists (
    select 1
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000031'
  ),
  'Signup trigger creates a profile'
);

-- ============================================================
-- Authenticated organization creation
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000031',
  true
);

select lives_ok(
  $$
    select public.create_organization(
      'Test Coffee Shop',
      'test-coffee-shop-creation'
    )
  $$,
  'Authenticated user can create an organization'
);

select is(
  (
    select name
    from public.organizations
    where slug = 'test-coffee-shop-creation'
  ),
  'Test Coffee Shop',
  'Organization name is saved correctly'
);

select is(
  (
    select role
    from public.organization_members
    where organization_id = (
      select id
      from public.organizations
      where slug = 'test-coffee-shop-creation'
    )
    and user_id = '00000000-0000-4000-8000-000000000031'
  ),
  'owner',
  'Creator receives owner role'
);

select is(
  (
    select status
    from public.organization_members
    where organization_id = (
      select id
      from public.organizations
      where slug = 'test-coffee-shop-creation'
    )
    and user_id = '00000000-0000-4000-8000-000000000031'
  ),
  'active',
  'Owner membership is active'
);

-- ============================================================
-- Duplicate slug protection
-- ============================================================

select throws_ok(
  $$
    select public.create_organization(
      'Another Coffee Shop',
      'test-coffee-shop-creation'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "organizations_slug_key"',
  'Duplicate organization slug is rejected'
);

-- ============================================================
-- Cross-organization ownership protection
-- ============================================================

-- Switch the authenticated identity to User B.

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000032',
  true
);

select ok(
  not exists (
    select 1
    from public.organizations
    where slug = 'test-coffee-shop-creation'
  ),
  'Other user cannot see creator organization'
);



select throws_ok(
  $$
    insert into public.organization_members (
      organization_id,
      user_id,
      role
    )
    values (
      '10000000-0000-4000-8000-000000000032',
      '00000000-0000-4000-8000-000000000032',
      'owner'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "organization_members"',
  'Other user cannot insert owner membership'
);



-- ============================================================
-- Anonymous access
-- ============================================================

reset role;
set local role anon;

select set_config(
  'request.jwt.claim.sub',
  '',
  true
);

select throws_ok(
  $$
    select public.create_organization(
      'Anonymous Organization',
      'anonymous-org-creation'
    )
  $$,
  '42501',
  'permission denied for function create_organization',
  'Anonymous user cannot execute organization creation'
);

-- ============================================================
-- Input validation
-- ============================================================

reset role;
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000031',
  true
);

select throws_ok(
  $$
    select public.create_organization(
      'Invalid Organization',
      'INVALID SLUG'
    )
  $$,
  '22023',
  'Invalid organization slug',
  'Invalid slugs are rejected'
);

select * from finish();

rollback;
