begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- =========================================================
-- Fixtures
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000003601',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'details-owner@test.local', ''
),
(
  '00000000-0000-4000-8000-000000003602',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'details-admin@test.local', ''
),
(
  '00000000-0000-4000-8000-000000003603',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'details-support@test.local', ''
),
(
  '00000000-0000-4000-8000-000000003604',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'details-user@test.local', ''
);

insert into public.platform_admins (user_id, role)
values
  ('00000000-0000-4000-8000-000000003601', 'owner'),
  ('00000000-0000-4000-8000-000000003602', 'admin'),
  ('00000000-0000-4000-8000-000000003603', 'support');

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000003611',
  'Details Partner Organization',
  'details-partner-036'
),
(
  '00000000-0000-4000-8000-000000003612',
  'Details Standard Organization',
  'details-standard-036'
);

insert into public.organization_benefits (
  organization_id,
  partner_granted_at,
  maintenance_starts_at,
  maintenance_ends_at
)
values (
  '00000000-0000-4000-8000-000000003611',
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
  '00000000-0000-4000-8000-000000003601',
  true
);

select is(
  (
    select organization_name
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003611'
    )
  ),
  'Details Partner Organization',
  'Platform Owner can retrieve organization details'
);

select is(
  (
    select benefit_level
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003611'
    )
  ),
  'partner_plus',
  'Active maintenance produces Partner+'
);

select is(
  (
    select benefit_level
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003612'
    )
  ),
  'standard',
  'Organization without Partner benefits is Standard'
);

select is(
  (
    select plan_id
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003611'
    )
  ),
  'free',
  'Default Free subscription is returned'
);

select is(
  (
    select count(*)::integer
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003699'
    )
  ),
  0,
  'Unknown organization returns no rows'
);

select is(
  (
    select count(*)::integer
    from public.get_platform_organization_details(null)
  ),
  0,
  'NULL organization ID returns no rows'
);

-- =========================================================
-- Platform Admin
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003602',
  true
);

select is(
  (
    select organization_name
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003612'
    )
  ),
  'Details Standard Organization',
  'Platform Admin can retrieve organization details'
);

-- =========================================================
-- Platform Support
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003603',
  true
);

select throws_ok(
  $$
    select *
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003611'
    )
  $$,
  '42501',
  'Platform administrator access required',
  'Platform Support cannot retrieve organization details'
);

-- =========================================================
-- Ordinary CRM User
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003604',
  true
);

select throws_ok(
  $$
    select *
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003611'
    )
  $$,
  '42501',
  'Platform administrator access required',
  'Ordinary CRM user cannot retrieve organization details'
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
    from public.get_platform_organization_details(
      '00000000-0000-4000-8000-000000003611'
    )
  $$,
  '42501',
  'permission denied for function get_platform_organization_details',
  'Anonymous callers cannot execute the RPC'
);

select * from finish();

rollback;