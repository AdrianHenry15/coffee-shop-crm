begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- Create an isolated organization fixture.
-- This transaction rolls back after testing.

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  created_at,
  updated_at
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'benefits-test@example.com',
  '',
  now(),
  now()
);

-- Use the existing organization creation RPC.
-- It creates the organization and owner membership.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  true
);

select public.create_organization(
  'Benefits Test Organization',
  'benefits-test-org'
);

-- Capture the organization ID.
create temporary table benefit_test_org as
select id
from public.organizations
where slug = 'benefits-test-org';

-- Return to privileged test role before calling
-- the private benefit-level function.
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 1. No benefits.
select is(
  private.get_organization_benefit_level(
    (select id from benefit_test_org)
  ),
  'standard',
  'Organization starts with standard benefits'
);

-- 2. Permanent Partner.
insert into public.organization_benefits (
  organization_id,
  partner_granted_at
)
values (
  (select id from benefit_test_org),
  now() - interval '30 days'
);

select is(
  private.get_organization_benefit_level(
    (select id from benefit_test_org)
  ),
  'partner',
  'Permanent Partner grant activates Partner benefits'
);

-- 3. Active maintenance.
update public.organization_benefits
set
  maintenance_starts_at = now() - interval '1 day',
  maintenance_ends_at = now() + interval '30 days'
where organization_id = (select id from benefit_test_org);

select is(
  private.get_organization_benefit_level(
    (select id from benefit_test_org)
  ),
  'partner_plus',
  'Active maintenance activates Partner+'
);

-- 4. Expired maintenance.
update public.organization_benefits
set
  maintenance_starts_at = now() - interval '60 days',
  maintenance_ends_at = now() - interval '1 day'
where organization_id = (select id from benefit_test_org);

select is(
  private.get_organization_benefit_level(
    (select id from benefit_test_org)
  ),
  'partner',
  'Expired maintenance returns to Partner'
);

-- 5. Future maintenance.
update public.organization_benefits
set
  maintenance_starts_at = now() + interval '7 days',
  maintenance_ends_at = now() + interval '37 days'
where organization_id = (select id from benefit_test_org);

select is(
  private.get_organization_benefit_level(
    (select id from benefit_test_org)
  ),
  'partner',
  'Future maintenance does not activate early'
);

-- 6. Maintenance cannot exist without Partner eligibility.
select throws_ok(
  format(
    $sql$
      update public.organization_benefits
      set
        partner_granted_at = null,
        maintenance_starts_at = now() - interval '1 day',
        maintenance_ends_at = now() + interval '30 days'
      where organization_id = %L::uuid
    $sql$,
    (select id from benefit_test_org)
  ),
  '23514',
  null,
  'Maintenance requires a Partner grant'
);

-- 7. Invalid maintenance date range.
select throws_ok(
  format(
    $sql$
      update public.organization_benefits
      set
        maintenance_starts_at = now() + interval '30 days',
        maintenance_ends_at = now()
      where organization_id = %L::uuid
    $sql$,
    (select id from benefit_test_org)
  ),
  '23514',
  null,
  'Invalid maintenance date range is rejected'
);

select finish();

rollback;