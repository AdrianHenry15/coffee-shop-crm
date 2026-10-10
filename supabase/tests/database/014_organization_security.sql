
begin;

select plan(7);

-- Create isolated test users.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  instance_id
)
values
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'authenticated',
  'authenticated',
  'security-owner@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'authenticated',
  'authenticated',
  'security-member@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
);

-- Authenticate as owner.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);

-- Test 1: Organization creation.
select lives_ok(
  $$
    select public.create_organization(
      'Security Test Organization',
      'security-test-organization-014'
    )
  $$,
  'Owner can create an organization'
);

-- Privileged setup.
set local role postgres;

-- Test 2: Organization exists.
select ok(
  exists (
    select 1
    from public.organizations
    where slug = 'security-test-organization-014'
  ),
  'Test organization exists'
);

-- Add a regular member.
insert into public.organization_members (
  organization_id,
  user_id,
  role
)
select
  id,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'member'
from public.organizations
where slug = 'security-test-organization-014';

-- Test 3: Verify membership was created.
select is(
  (
    select role::text
    from public.organization_members
    where user_id =
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  'member',
  'Test member was created successfully'
);

-- Authenticate as regular member.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  true
);

-- Test 4: Member can read their organization.
select is(
  (
    select count(*)::integer
    from public.organizations
    where slug = 'security-test-organization-014'
  ),
  1,
  'Member can read their organization'
);

-- Attempt unauthorized role escalation.
update public.organization_members
set role = 'owner'
where user_id =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- Privileged verification.
set local role postgres;

-- Test 5: Member remains a member.
select is(
  (
    select role::text
    from public.organization_members
    where user_id =
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  'member',
  'Member cannot promote themselves to owner'
);

-- Authenticate as member again.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  true
);

-- Test 6: Member can read timezone.
select is(
  (
    select timezone
    from public.organizations
    where slug = 'security-test-organization-014'
  ),
  'America/New_York',
  'Member can read organization timezone'
);

-- Attempt unauthorized settings update.
update public.organizations
set timezone = 'America/Chicago'
where slug = 'security-test-organization-014';

-- Verify with privileged access.
set local role postgres;

-- Test 7: Timezone remains unchanged.
select is(
  (
    select timezone
    from public.organizations
    where slug = 'security-test-organization-014'
  ),
  'America/New_York',
  'Member cannot change organization timezone'
);

select * from finish();

rollback;
