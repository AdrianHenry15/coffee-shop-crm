begin;

select plan(14);

-- =========================================================
-- Setup: Free Standard organization
-- =========================================================

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000003101',
  'Partner Enforcement Test',
  'partner-enforcement-test-031'
);

-- =========================================================
-- 1. Free Standard: 25 customers
-- =========================================================

insert into public.customers (organization_id, name)
select
  '00000000-0000-4000-8000-000000003101',
  'Customer ' || number
from generate_series(1, 25) as number;

select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000003101'
  ),
  25,
  'Free Standard allows 25 customers'
);

select throws_ok(
  $$
    insert into public.customers (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000003101',
      'Customer 26'
    )
  $$,
  'P0001',
  'Subscription limit reached for customers',
  'Free Standard rejects customer 26'
);

-- =========================================================
-- 2. Grant permanent Partner benefits
-- =========================================================

insert into public.organization_benefits (
  organization_id,
  partner_granted_at
)
values (
  '00000000-0000-4000-8000-000000003101',
  now() - interval '1 day'
);

select is(
  private.get_organization_benefit_level(
    '00000000-0000-4000-8000-000000003101'
  ),
  'partner',
  'Permanent Partner benefits activate'
);

select lives_ok(
  $$
    insert into public.customers (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000003101',
      'Customer 26'
    )
  $$,
  'Partner allows customer 26'
);

-- Fill Partner capacity (250 total).
insert into public.customers (organization_id, name)
select
  '00000000-0000-4000-8000-000000003101',
  'Partner Customer ' || number
from generate_series(27, 250) as number;

select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000003101'
  ),
  250,
  'Free Partner allows 250 customers'
);

select throws_ok(
  $$
    insert into public.customers (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000003101',
      'Customer 251'
    )
  $$,
  'P0001',
  'Subscription limit reached for customers',
  'Free Partner rejects customer 251'
);

-- =========================================================
-- 3. Activate Partner+
-- =========================================================

update public.organization_benefits
set
  maintenance_starts_at = now() - interval '1 day',
  maintenance_ends_at = now() + interval '30 days'
where organization_id =
  '00000000-0000-4000-8000-000000003101';

select is(
  private.get_organization_benefit_level(
    '00000000-0000-4000-8000-000000003101'
  ),
  'partner_plus',
  'Active maintenance activates Partner+'
);

select lives_ok(
  $$
    insert into public.customers (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000003101',
      'Customer 251'
    )
  $$,
  'Partner+ allows customer 251'
);

-- =========================================================
-- 4. Expired maintenance
-- =========================================================

update public.organization_benefits
set
  maintenance_starts_at = now() - interval '60 days',
  maintenance_ends_at = now() - interval '1 day'
where organization_id =
  '00000000-0000-4000-8000-000000003101';

select is(
  private.get_organization_benefit_level(
    '00000000-0000-4000-8000-000000003101'
  ),
  'partner',
  'Expired maintenance restores Partner benefits'
);

select throws_ok(
  $$
    insert into public.customers (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000003101',
      'Customer After Expiration'
    )
  $$,
  'P0001',
  'Subscription limit reached for customers',
  'Expired Partner+ cannot exceed Partner limit'
);

-- =========================================================
-- 5. Inactive subscription
-- =========================================================

update public.organization_subscriptions
set status = 'canceled'
where organization_id =
  '00000000-0000-4000-8000-000000003101';

select throws_ok(
  $$
    insert into public.customers (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000003101',
      'Canceled Subscription Customer'
    )
  $$,
  'P0001',
  'Organization subscription is not active',
  'Canceled Partner subscription rejects inserts'
);

-- =========================================================
-- 6. Verify usage reporting uses effective limits
-- =========================================================

-- Restore subscription and Partner+.
update public.organization_subscriptions
set status = 'active'
where organization_id =
  '00000000-0000-4000-8000-000000003101';

update public.organization_benefits
set
  maintenance_starts_at = now() - interval '1 day',
  maintenance_ends_at = now() + interval '30 days'
where organization_id =
  '00000000-0000-4000-8000-000000003101';

select is(
  private.get_effective_subscription_limit(
    '00000000-0000-4000-8000-000000003101',
    'customers'
  ),
  500,
  'Partner+ effective customer limit is 500'
);

select is(
  (
    select count(*)::integer
    from public.customers
    where organization_id =
      '00000000-0000-4000-8000-000000003101'
  ),
  251,
  'Existing customers remain intact after benefit changes'
);

-- =========================================================
-- 7. Reject unsupported resource
-- =========================================================

select throws_ok(
  $$
    select private.get_effective_subscription_limit(
      '00000000-0000-4000-8000-000000003101',
      'unsupported'
    )
  $$,
  '22023',
  null,
  'Unsupported resources are rejected'
);

select * from finish();

rollback;