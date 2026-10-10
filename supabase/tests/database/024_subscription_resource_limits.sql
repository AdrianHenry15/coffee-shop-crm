begin;

select plan(12);

-- =========================================================
-- Setup
-- =========================================================

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000002401',
  'Resource Limits Test',
  'resource-limits-test-024'
);

insert into public.customers (
  id, organization_id, name
)
values (
  '00000000-0000-4000-8000-000000002402',
  '00000000-0000-4000-8000-000000002401',
  'Resource Test Customer'
);

-- =========================================================
-- Leads: Free limit = 25
-- =========================================================

insert into public.leads (organization_id, name)
select
  '00000000-0000-4000-8000-000000002401',
  'Lead ' || number
from generate_series(1, 25) as number;

select is(
  (
    select count(*)::integer
    from public.leads
    where organization_id =
      '00000000-0000-4000-8000-000000002401'
  ),
  25,
  'Free allows 25 leads'
);

select throws_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002401',
      'Lead 26'
    )
  $$,
  'P0001',
  'Subscription limit reached for leads',
  'Free rejects lead 26'
);

select is(
  (
    select count(*)::integer
    from public.leads
    where organization_id =
      '00000000-0000-4000-8000-000000002401'
  ),
  25,
  'Rejected lead does not increase usage'
);

-- =========================================================
-- Estimates: Free limit = 10
-- =========================================================

insert into public.estimates (
  organization_id, customer_id
)
select
  '00000000-0000-4000-8000-000000002401',
  '00000000-0000-4000-8000-000000002402'
from generate_series(1, 10);

select is(
  (
    select count(*)::integer
    from public.estimates
    where organization_id =
      '00000000-0000-4000-8000-000000002401'
  ),
  10,
  'Free allows 10 estimates'
);

select throws_ok(
  $$
    insert into public.estimates (
      organization_id, customer_id
    )
    values (
      '00000000-0000-4000-8000-000000002401',
      '00000000-0000-4000-8000-000000002402'
    )
  $$,
  'P0001',
  'Subscription limit reached for estimates',
  'Free rejects estimate 11'
);

select is(
  (
    select count(*)::integer
    from public.estimates
    where organization_id =
      '00000000-0000-4000-8000-000000002401'
  ),
  10,
  'Rejected estimate does not increase usage'
);

-- =========================================================
-- Jobs: Free limit = 10
-- =========================================================

insert into public.jobs (
  organization_id, customer_id, title
)
select
  '00000000-0000-4000-8000-000000002401',
  '00000000-0000-4000-8000-000000002402',
  'Job ' || number
from generate_series(1, 10) as number;

select is(
  (
    select count(*)::integer
    from public.jobs
    where organization_id =
      '00000000-0000-4000-8000-000000002401'
  ),
  10,
  'Free allows 10 jobs'
);

select throws_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id, title
    )
    values (
      '00000000-0000-4000-8000-000000002401',
      '00000000-0000-4000-8000-000000002402',
      'Job 11'
    )
  $$,
  'P0001',
  'Subscription limit reached for jobs',
  'Free rejects job 11'
);

select is(
  (
    select count(*)::integer
    from public.jobs
    where organization_id =
      '00000000-0000-4000-8000-000000002401'
  ),
  10,
  'Rejected job does not increase usage'
);

-- =========================================================
-- Starter: higher/unlimited limits
-- =========================================================

update public.organization_subscriptions
set plan_id = 'starter'
where organization_id =
  '00000000-0000-4000-8000-000000002401';

select lives_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002401',
      'Lead 26'
    )
  $$,
  'Starter allows lead 26'
);

select lives_ok(
  $$
    insert into public.estimates (
      organization_id, customer_id
    )
    values (
      '00000000-0000-4000-8000-000000002401',
      '00000000-0000-4000-8000-000000002402'
    )
  $$,
  'Starter allows estimate 11'
);

select lives_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id, title
    )
    values (
      '00000000-0000-4000-8000-000000002401',
      '00000000-0000-4000-8000-000000002402',
      'Job 11'
    )
  $$,
  'Starter allows job 11'
);

select * from finish();

rollback;