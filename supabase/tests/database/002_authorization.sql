
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
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'owner-a@test.local', ''
),
(
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'owner-b@test.local', ''
),
(
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'member-a@test.local', ''
);

update public.profiles
set first_name = 'Test User'
where id = '00000000-0000-4000-8000-000000000011';

insert into public.organizations (id, name, slug)
values
(
  '10000000-0000-4000-8000-000000000011',
  'Organization A',
  'authorization-org-a'
),
(
  '10000000-0000-4000-8000-000000000012',
  'Organization B',
  'authorization-org-b'
);

-- Organization A requires multiple members for authorization tests.
update public.organization_subscriptions
set plan_id = 'pro'
where organization_id = '10000000-0000-4000-8000-000000000011';

insert into public.organization_members (
  organization_id, user_id, role
)
values
(
  '10000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000011',
  'owner'
),
(
  '10000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000012',
  'owner'
),
(
  '10000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000013',
  'member'
);

-- ============================================================
-- Owner A
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000011',
  true
);

select ok(
  private.is_org_owner(
    '10000000-0000-4000-8000-000000000011'
  ),
  'Owner A is recognized as owner'
);

select ok(
  not private.is_org_owner(
    '10000000-0000-4000-8000-000000000012'
  ),
  'Owner A is not owner of Organization B'
);

select lives_ok(
  $$
    update public.organizations
    set name = 'Organization A Updated'
    where id = '10000000-0000-4000-8000-000000000011'
  $$,
  'Owner A can update Organization A'
);

select is(
  (
    select name from public.organizations
    where id = '10000000-0000-4000-8000-000000000011'
  ),
  'Organization A Updated',
  'Organization A name was updated'
);

-- Attempt to modify another organization.
select lives_ok(
  $$
    update public.organizations
    set name = 'Unauthorized Change'
    where id = '10000000-0000-4000-8000-000000000012'
  $$,
  'Cross-organization UPDATE executes without error'
);

select is(
  (
    select count(*) from public.organizations
    where name = 'Unauthorized Change'
  ),
  0::bigint,
  'Cross-organization update changed no visible records'
);

-- ============================================================
-- Ordinary Member A
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000013',
  true
);

select ok(
  not private.is_org_owner(
    '10000000-0000-4000-8000-000000000011'
  ),
  'Ordinary member is not an owner'
);

select lives_ok(
  $$
    update public.organizations
    set name = 'Member Unauthorized Change'
    where id = '10000000-0000-4000-8000-000000000011'
  $$,
  'Member UPDATE executes without error'
);

select is(
  (
    select name from public.organizations
    where id = '10000000-0000-4000-8000-000000000011'
  ),
  'Organization A Updated',
  'Ordinary member cannot change organization details'
);

-- ============================================================
-- Membership suspension
-- ============================================================

-- Return to the trusted test role for fixture modification.
reset role;

update public.organization_members
set status = 'suspended'
where user_id =
  '00000000-0000-4000-8000-000000000013';

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000013',
  true
);

select ok(
  not private.is_org_member(
    '10000000-0000-4000-8000-000000000011'
  ),
  'Suspended member loses organization access'
);

select * from finish();

rollback;
