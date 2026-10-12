
begin;

select plan(8);

-- Test users
insert into auth.users (
  id, aud, role, email, encrypted_password, instance_id
)
values
(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'authenticated',
  'authenticated',
  'tenant-a@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
),
(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'authenticated',
  'authenticated',
  'tenant-b@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
);

-- Create organizations as their respective owners.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  true
);

select public.create_organization(
  'Security Tenant A',
  'security-tenant-a-015'
);

select set_config(
  'request.jwt.claim.sub',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  true
);

select public.create_organization(
  'Security Tenant B',
  'security-tenant-b-015'
);

-- Create records belonging to Tenant B.
insert into public.customers (
  organization_id, name
)
select id, 'Tenant B Customer'
from public.organizations
where slug = 'security-tenant-b-015';

insert into public.estimates (
  organization_id, customer_id
)
select
  o.id,
  c.id
from public.organizations o
join public.customers c
  on c.organization_id = o.id
where o.slug = 'security-tenant-b-015'
  and c.name = 'Tenant B Customer';

insert into public.jobs (
  organization_id,
  customer_id,
  title
)
select
  o.id,
  c.id,
  'Tenant B Job'
from public.organizations o
join public.customers c
  on c.organization_id = o.id
where o.slug = 'security-tenant-b-015'
  and c.name = 'Tenant B Customer';

-- Switch to Tenant A.
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  true
);

-- Test 1: Cannot read Tenant B customers.
select is(
  (
    select count(*)::integer
    from public.customers
    where name = 'Tenant B Customer'
  ),
  0,
  'Tenant A cannot read Tenant B customers'
);

-- Test 2: Cannot read Tenant B estimates.
select is(
  (
    select count(*)::integer
    from public.estimates
  ),
  0,
  'Tenant A cannot read Tenant B estimates'
);

-- Test 3: Cannot read Tenant B jobs.
select is(
  (
    select count(*)::integer
    from public.jobs
    where title = 'Tenant B Job'
  ),
  0,
  'Tenant A cannot read Tenant B jobs'
);


-- Test 4: Attempt to update Tenant B customer.
update public.customers
set name = 'Hacked Customer'
where name = 'Tenant B Customer';

set local role postgres;

select is(
  (
    select count(*)::integer
    from public.customers
    where name = 'Tenant B Customer'
  ),
  1,
  'Tenant A cannot modify Tenant B customer'
);

-- Switch back to Tenant A.
set local role authenticated;

-- Test 5: Attempt to update Tenant B estimate.
update public.estimates
set notes = 'Unauthorized change'
where notes is null;

set local role postgres;

select is(
  (
    select count(*)::integer
    from public.estimates
    where notes = 'Unauthorized change'
  ),
  0,
  'Tenant A cannot modify Tenant B estimate'
);

set local role authenticated;

-- Test 6: Attempt to update Tenant B job.
update public.jobs
set title = 'Hacked Job'
where title = 'Tenant B Job';

set local role postgres;

select is(
  (
    select count(*)::integer
    from public.jobs
    where title = 'Tenant B Job'
  ),
  1,
  'Tenant A cannot modify Tenant B job'
);

set local role authenticated;

-- Test 7: Attempt to delete Tenant B customer.
delete from public.customers
where name = 'Tenant B Customer';

set local role postgres;

select is(
  (
    select count(*)::integer
    from public.customers
    where name = 'Tenant B Customer'
  ),
  1,
  'Tenant A cannot delete Tenant B customer'
);

set local role authenticated;

-- Test 8: Attempt to delete Tenant B job.
delete from public.jobs
where title = 'Tenant B Job';

set local role postgres;

select is(
  (
    select count(*)::integer
    from public.jobs
    where title = 'Tenant B Job'
  ),
  1,
  'Tenant A cannot delete Tenant B job'
);

select * from finish();

rollback;

