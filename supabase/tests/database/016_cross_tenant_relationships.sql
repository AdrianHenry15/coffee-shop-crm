
begin;

select plan(6);

-- Store fixture IDs independently of RLS-protected tables.
create temporary table test_ids (
  key text primary key,
  id uuid not null
);

grant select on table test_ids to authenticated;

-- Create test users.
insert into auth.users (
  id, aud, role, email, encrypted_password, instance_id
)
values
(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'authenticated',
  'authenticated',
  'relationship-a@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
),
(
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'authenticated',
  'authenticated',
  'relationship-b@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
);

-- These fixtures represent users who confirmed their email.
update auth.users
set email_confirmed_at = now()
where id in (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
);

-- Create both organizations using the existing RPC.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  true
);

select public.onboard_organization(
      'Relationship Tenant A',
      'relationship-tenant-a-016',
      'business@example.com',
      null,
      null,
      null,
      'America/New_York'
    );

select set_config(
  'request.jwt.claim.sub',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  true
);

select public.onboard_organization(
      'Relationship Tenant B',
      'relationship-tenant-b-016',
      'business@example.com',
      null,
      null,
      null,
      'America/New_York'
    );

-- Set up fixture records with privileged access.
set local role postgres;

insert into test_ids (key, id)
select 'org_a', id
from public.organizations
where slug = 'relationship-tenant-a-016';

insert into test_ids (key, id)
select 'org_b', id
from public.organizations
where slug = 'relationship-tenant-b-016';

insert into public.customers (
  organization_id, name
)
select id, 'Relationship Customer B'
from test_ids
where key = 'org_b';

insert into test_ids (key, id)
select 'customer_b', id
from public.customers
where name = 'Relationship Customer B';

insert into public.estimates (
  organization_id, customer_id, notes
)
select
  (select id from test_ids where key = 'org_b'),
  (select id from test_ids where key = 'customer_b'),
  'Relationship Estimate B';

insert into test_ids (key, id)
select 'estimate_b', id
from public.estimates
where notes = 'Relationship Estimate B';

-- Verify fixture records exist.
select is(
  (select count(*)::integer from test_ids),
  4,
  'All four fixture IDs were created'
);

-- Authenticate as Tenant A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  true
);

-- Test 2: Cannot create an estimate with another tenant's customer.
select throws_ok(
  format(
    'insert into public.estimates (organization_id, customer_id)
     values (%L, %L)',
    (select id from test_ids where key = 'org_a'),
    (select id from test_ids where key = 'customer_b')
  ),
  '23503',
  null,
  'Cross-tenant estimate customer relationship is rejected'
);

-- Test 3: Cannot create a job with another tenant's customer.
select throws_ok(
  format(
    'insert into public.jobs (organization_id, customer_id, title)
     values (%L, %L, %L)',
    (select id from test_ids where key = 'org_a'),
    (select id from test_ids where key = 'customer_b'),
    'Invalid Cross-Tenant Job'
  ),
  '23503',
  null,
  'Cross-tenant job customer relationship is rejected'
);

-- Test 4: Cannot attach an item to another tenant's estimate.
select throws_ok(
  format(
    'insert into public.estimate_items
      (organization_id, estimate_id, position, description, quantity, unit_price_cents)
     values (%L, %L, 0, %L, 1, 1000)',
    (select id from test_ids where key = 'org_a'),
    (select id from test_ids where key = 'estimate_b'),
    'Invalid Cross-Tenant Item'
  ),
  'P0001',
  'Estimate not found',
  'Cross-tenant estimate item relationship is rejected'
);

-- Verify no invalid records were inserted.
set local role postgres;

select is(
  (
    select count(*)::integer
    from public.estimates
    where organization_id =
      (select id from test_ids where key = 'org_a')
  ),
  0,
  'No invalid estimate was created'
);

select is(
  (
    select count(*)::integer
    from public.jobs
    where organization_id =
      (select id from test_ids where key = 'org_a')
  ),
  0,
  'No invalid job was created'
);

select * from finish();

rollback;
