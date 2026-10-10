
begin;

select plan(7);

-- Create two test users.
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
  '18181818-1818-4818-8818-181818181818',
  'authenticated',
  'authenticated',
  'deletion-owner-a@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
),
(
  '19191919-1919-4919-8919-191919191919',
  'authenticated',
  'authenticated',
  'deletion-owner-b@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
);

-- Organization A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '18181818-1818-4818-8818-181818181818',
  true
);

select public.create_organization(
  'Deletion Test A',
  'deletion-test-a-018'
);

insert into public.customers (organization_id, name)
select id, 'Deletion Customer A'
from public.organizations
where slug = 'deletion-test-a-018';

insert into public.estimates (
  organization_id,
  customer_id,
  notes
)
select o.id, c.id, 'Secure Deletion A'
from public.organizations o
join public.customers c
  on c.organization_id = o.id
where o.slug = 'deletion-test-a-018';

insert into public.estimate_items (
  organization_id,
  estimate_id,
  position,
  description,
  quantity,
  unit_price_cents
)
select
  organization_id,
  id,
  0,
  'Secure Deletion Item A',
  1,
  1000
from public.estimates
where notes = 'Secure Deletion A';

update public.estimates
set status = 'sent'
where notes = 'Secure Deletion A';

update public.estimates
set status = 'accepted'
where notes = 'Secure Deletion A';

-- Organization B.
select set_config(
  'request.jwt.claim.sub',
  '19191919-1919-4919-8919-191919191919',
  true
);

select public.create_organization(
  'Deletion Test B',
  'deletion-test-b-018'
);

insert into public.customers (organization_id, name)
select id, 'Deletion Customer B'
from public.organizations
where slug = 'deletion-test-b-018';

insert into public.estimates (
  organization_id,
  customer_id,
  notes
)
select o.id, c.id, 'Secure Deletion B'
from public.organizations o
join public.customers c
  on c.organization_id = o.id
where o.slug = 'deletion-test-b-018';

insert into public.estimate_items (
  organization_id,
  estimate_id,
  position,
  description,
  quantity,
  unit_price_cents
)
select
  organization_id,
  id,
  0,
  'Secure Deletion Item B',
  1,
  1000
from public.estimates
where notes = 'Secure Deletion B';

-- Test 1: Direct estimate deletion is forbidden.
select throws_ok(
  $$
    delete from public.estimates
    where notes = 'Secure Deletion B'
  $$,
  '42501',
  null,
  'Direct estimate deletion is forbidden'
);

-- Test 2: Authorized RPC deletes estimate B.
select lives_ok(
  format(
    'select public.delete_estimate(%L::uuid, %L::uuid)',
    (
      select id
      from public.organizations
      where slug = 'deletion-test-b-018'
    ),
    (
      select id
      from public.estimates
      where notes = 'Secure Deletion B'
    )
  ),
  'Authorized deletion RPC succeeds'
);

-- Test 3: Estimate B is gone.
select is(
  (
    select count(*)::integer
    from public.estimates
    where notes = 'Secure Deletion B'
  ),
  0,
  'Deleted estimate no longer exists'
);

-- Test 4: Its item is gone.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where description = 'Secure Deletion Item B'
  ),
  0,
  'Deleted estimate items are removed'
);

-- Switch back to Organization A.
select set_config(
  'request.jwt.claim.sub',
  '18181818-1818-4818-8818-181818181818',
  true
);

-- Test 5: Finalized items cannot be directly deleted.
select throws_ok(
  $$
    delete from public.estimate_items
    where description = 'Secure Deletion Item A'
  $$,
  'P0001',
  null,
  'Finalized estimate items cannot be directly deleted'
);

-- Test 6: Cross-tenant RPC deletion is rejected.
select throws_ok(
  $$
    select public.delete_estimate(
      (select id from public.organizations
       where slug = 'deletion-test-b-018'),
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001',
  null,
  'Cross-tenant estimate deletion is rejected'
);

-- Test 7: Accepted estimate can be deleted through RPC.
select lives_ok(
  format(
    'select public.delete_estimate(%L::uuid, %L::uuid)',
    (
      select id
      from public.organizations
      where slug = 'deletion-test-a-018'
    ),
    (
      select id
      from public.estimates
      where notes = 'Secure Deletion A'
    )
  ),
  'Accepted estimate can be deleted through RPC'
);

select * from finish();

rollback;
