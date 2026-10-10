begin;

select plan(4);

-- =========================================================
-- Setup
-- =========================================================

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000002201',
  'Subscription Limits Test',
  'subscription-limits-test-022'
);

-- Test 1: Organization starts on Free.
select is(
  (
    select plan_id
    from public.organization_subscriptions
    where organization_id =
      '00000000-0000-4000-8000-000000002201'
  ),
  'free',
  'Organization starts on the Free plan'
);

-- =========================================================
-- Free customer limit
-- =========================================================

-- Insert exactly 25 customers.
insert into public.customers (
  organization_id,
  name
)
select
  '00000000-0000-4000-8000-000000002201',
  'Test Customer ' || number
from generate_series(1, 25) as number;

-- Test 2: Free allows 25 customers.
select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000002201'
  ),
  25,
  'Free plan allows 25 customers'
);

-- Test 3: Customer 26 is rejected.
select throws_ok(
  $$
    insert into public.customers (
      organization_id,
      name
    )
    values (
      '00000000-0000-4000-8000-000000002201',
      'Customer 26'
    )
  $$,
  'P0001',
  'Subscription limit reached for customers',
  'Free plan rejects customer 26'
);

-- =========================================================
-- Pro unlimited customers
-- =========================================================

update public.organization_subscriptions
set plan_id = 'pro'
where organization_id =
  '00000000-0000-4000-8000-000000002201';

-- Test 4: Pro allows additional customers.
select lives_ok(
  $$
    insert into public.customers (
      organization_id,
      name
    )
    values (
      '00000000-0000-4000-8000-000000002201',
      'Customer 26'
    )
  $$,
  'Pro plan allows customers beyond the Free limit'
);

select * from finish();

rollback;