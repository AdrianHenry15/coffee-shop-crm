begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

-- =========================================================
-- Fixtures
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000003501',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'directory-owner@test.local', ''
),
(
  '00000000-0000-4000-8000-000000003502',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'directory-admin@test.local', ''
),
(
  '00000000-0000-4000-8000-000000003503',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'directory-support@test.local', ''
),
(
  '00000000-0000-4000-8000-000000003504',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'directory-member@test.local', ''
);

insert into public.platform_admins (user_id, role)
values
  ('00000000-0000-4000-8000-000000003501', 'owner'),
  ('00000000-0000-4000-8000-000000003502', 'admin'),
  ('00000000-0000-4000-8000-000000003503', 'support');

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000003511',
  'Directory Alpha',
  'directory-alpha-035'
),
(
  '00000000-0000-4000-8000-000000003512',
  'Directory Beta',
  'directory-beta-035'
),
(
  '00000000-0000-4000-8000-000000003513',
  'Directory Gamma',
  'directory-gamma-035'
);

-- Give Alpha Partner benefits.
insert into public.organization_benefits (
  organization_id,
  partner_granted_at
)
values (
  '00000000-0000-4000-8000-000000003511',
  now()
);

-- Give Beta active Partner+ benefits.
insert into public.organization_benefits (
  organization_id,
  partner_granted_at,
  maintenance_starts_at,
  maintenance_ends_at
)
values (
  '00000000-0000-4000-8000-000000003512',
  now(),
  now() - interval '1 day',
  now() + interval '30 days'
);

-- =========================================================
-- Platform Owner
-- =========================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003501',
  true
);

select is(
  (
    select count(*)::integer
    from public.get_platform_organizations('directory-', 1, 20)
  ),
  3,
  'Platform Owner can list all matching organizations'
);

select is(
  (
    select benefit_level
    from public.get_platform_organizations('directory-alpha-035', 1, 20)
    limit 1
  ),
  'partner',
  'Partner organization has correct benefit level'
);

select is(
  (
    select benefit_level
    from public.get_platform_organizations('directory-beta-035', 1, 20)
    limit 1
  ),
  'partner_plus',
  'Active maintenance produces Partner+'
);

select is(
  (
    select benefit_level
    from public.get_platform_organizations('directory-gamma-035', 1, 20)
    limit 1
  ),
  'standard',
  'Organization without benefits is Standard'
);

select is(
  (
    select count(*)::integer
    from public.get_platform_organizations('directory-', 1, 2)
  ),
  2,
  'Pagination limits returned rows'
);

select is(
  (
    select total_count
    from public.get_platform_organizations('directory-', 1, 2)
    limit 1
  ),
  3::bigint,
  'Pagination preserves total matching count'
);

select is(
  (
    select count(*)::integer
    from public.get_platform_organizations('DIRECTORY-ALPHA', 1, 20)
  ),
  1,
  'Search is case-insensitive'
);

select throws_ok(
  $$
    select *
    from public.get_platform_organizations('', 0, 20)
  $$,
  '22023',
  'Invalid page number',
  'Page zero is rejected'
);

select throws_ok(
  $$
    select *
    from public.get_platform_organizations('', 1, 101)
  $$,
  '22023',
  'Page size must be between 1 and 100',
  'Page size above 100 is rejected'
);

-- =========================================================
-- Platform Admin
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003502',
  true
);

select is(
  (
    select count(*)::integer
    from public.get_platform_organizations('directory-', 1, 20)
  ),
  3,
  'Platform Admin can list organizations'
);

-- =========================================================
-- Platform Support
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003503',
  true
);

select throws_ok(
  $$
    select *
    from public.get_platform_organizations('directory-', 1, 20)
  $$,
  '42501',
  'Platform administrator access required',
  'Platform Support cannot list organizations'
);

-- =========================================================
-- Ordinary CRM User
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003504',
  true
);

select throws_ok(
  $$
    select *
    from public.get_platform_organizations('directory-', 1, 20)
  $$,
  '42501',
  'Platform administrator access required',
  'Ordinary user cannot list organizations'
);

-- =========================================================
-- Anonymous
-- =========================================================

reset role;

select set_config('request.jwt.claim.sub', '', true);

set local role anon;

select throws_ok(
  $$
    select *
    from public.get_platform_organizations('directory-', 1, 20)
  $$,
  '42501',
  'permission denied for function get_platform_organizations',
  'Anonymous callers cannot execute the RPC'
);

-- =========================================================
-- Finish
-- =========================================================

reset role;

select is(
  (
    select count(*)::integer
    from public.organizations
    where slug in (
      'directory-alpha-035',
      'directory-beta-035',
      'directory-gamma-035'
    )
  ),
  3,
  'All fixture organizations remain intact'
);

select * from finish();

rollback;