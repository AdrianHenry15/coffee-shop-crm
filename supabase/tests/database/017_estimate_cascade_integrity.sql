
begin;

select plan(9);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  instance_id
)
values (
  '17171717-1717-4717-8717-171717171717',
  'authenticated',
  'authenticated',
  'estimate-cascade@test.local',
  '',
  '00000000-0000-0000-0000-000000000000'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '17171717-1717-4717-8717-171717171717',
  true
);

select public.create_organization(
  'Cascade Test Organization',
  'cascade-test-organization-017'
);

-- Create a customer.
insert into public.customers (
  organization_id,
  name
)
select id, 'Cascade Test Customer'
from public.organizations
where slug = 'cascade-test-organization-017';

-- Create three estimates.
insert into public.estimates (
  organization_id,
  customer_id,
  notes
)
select
  o.id,
  c.id,
  v.notes
from public.organizations o
join public.customers c
  on c.organization_id = o.id
cross join (
  values
    ('Cascade Draft'),
    ('Cascade Sent'),
    ('Cascade Accepted')
) as v(notes)
where o.slug = 'cascade-test-organization-017'
  and c.name = 'Cascade Test Customer';

-- Add one item to each draft estimate.
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
  'Cascade Test Item',
  1,
  1000
from public.estimates
where notes in (
  'Cascade Draft',
  'Cascade Sent',
  'Cascade Accepted'
);

-- Move estimates through valid status transitions.
update public.estimates
set status = 'sent'
where notes in ('Cascade Sent', 'Cascade Accepted');

update public.estimates
set status = 'accepted'
where notes = 'Cascade Accepted';

-- Test 1: Three estimates exist.
select is(
  (
    select count(*)::integer
    from public.estimates
    where notes like 'Cascade %'
  ),
  3,
  'Three cascade test estimates exist'
);

-- Test 2: Three items exist.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where description = 'Cascade Test Item'
  ),
  3,
  'Each estimate has one item'
);

-- Test 3: Direct deletion of accepted item is rejected.
select throws_ok(
  $$
    delete from public.estimate_items
    where estimate_id = (
      select id
      from public.estimates
      where notes = 'Cascade Accepted'
    )
  $$,
  'P0001',
  null,
  'Accepted estimate items cannot be directly deleted'
);

-- Test 4: Direct update of accepted item is rejected.
select throws_ok(
  $$
    update public.estimate_items
    set quantity = 5
    where estimate_id = (
      select id
      from public.estimates
      where notes = 'Cascade Accepted'
    )
  $$,
  'P0001',
  null,
  'Accepted estimate items cannot be updated'
);

-- Test 5: Draft estimate deletion succeeds.
select lives_ok(
  $$
    select public.delete_estimate(
  (
    select organization_id
    from public.estimates
    where notes = 'Cascade Draft'
  ),
  (
    select id
    from public.estimates
    where notes = 'Cascade Draft'
  )
);
  $$,
  'Draft estimate can be deleted'
);

-- Test 6: Draft item was removed.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where description = 'Cascade Test Item'
  ),
  2,
  'Draft estimate items cascade on deletion'
);

-- Test 7: Sent estimate deletion succeeds.
select lives_ok(
  $$
   select public.delete_estimate(
  (
    select organization_id
    from public.estimates
    where notes = 'Cascade Sent'
  ),
  (
    select id
    from public.estimates
    where notes = 'Cascade Sent'
  )
);
  $$,
  'Sent estimate can be deleted'
);

-- Test 8: Sent item was removed.
select is(
  (
    select count(*)::integer
    from public.estimate_items
    where description = 'Cascade Test Item'
  ),
  1,
  'Sent estimate items cascade on deletion'
);

-- Create a job linked to the accepted estimate.
insert into public.jobs (
  organization_id,
  customer_id,
  estimate_id,
  title
)
select
  e.organization_id,
  e.customer_id,
  e.id,
  'Cascade Linked Job'
from public.estimates e
where e.notes = 'Cascade Accepted';


-- Test 9: Linked estimate cannot be deleted.
select throws_ok(
  $$
    select public.delete_estimate(
      (
        select organization_id
        from public.estimates
        where notes = 'Cascade Accepted'
      ),
      (
        select id
        from public.estimates
        where notes = 'Cascade Accepted'
      )
    );
  $$,
  '23503',
  null,
  'Estimate linked to a job cannot be deleted'
);


select * from finish();

rollback;
