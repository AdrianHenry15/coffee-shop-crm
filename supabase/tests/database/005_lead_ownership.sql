
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- ============================================================
-- Fixtures
-- ============================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values (
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'multi-org-user@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values
(
  '10000000-0000-4000-8000-000000000051',
  'Ownership Organization A',
  'ownership-org-a-test'
),
(
  '10000000-0000-4000-8000-000000000052',
  'Ownership Organization B',
  'ownership-org-b-test'
);

insert into public.organization_members (
  organization_id, user_id, role, status
)
values
(
  '10000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000051',
  'owner',
  'active'
),
(
  '10000000-0000-4000-8000-000000000052',
  '00000000-0000-4000-8000-000000000051',
  'owner',
  'active'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000051',
  true
);

-- ============================================================
-- Create lead
-- ============================================================

select lives_ok(
  $$
    insert into public.leads (
      id, organization_id, name
    )
    values (
      '20000000-0000-4000-8000-000000000051',
      '10000000-0000-4000-8000-000000000051',
      'Protected Lead'
    )
  $$,
  'Multi-org member can create a lead'
);

-- ============================================================
-- Attempt to transfer ownership
-- ============================================================

select throws_ok(
  $$
    update public.leads
    set organization_id =
      '10000000-0000-4000-8000-000000000052'
    where id =
      '20000000-0000-4000-8000-000000000051'
  $$,
  '23514',
  'Lead organization cannot be changed',
  'Lead cannot be transferred between organizations'
);

-- ============================================================
-- Verify original ownership
-- ============================================================

select is(
  (
    select organization_id
    from public.leads
    where id = '20000000-0000-4000-8000-000000000051'
  ),
  '10000000-0000-4000-8000-000000000051'::uuid,
  'Lead retains its original organization'
);

-- ============================================================
-- Verify normal updates still work
-- ============================================================

select lives_ok(
  $$
    update public.leads
    set name = 'Updated Protected Lead'
    where id =
      '20000000-0000-4000-8000-000000000051'
  $$,
  'Normal lead updates remain allowed'
);

select * from finish();

rollback;
