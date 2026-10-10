
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- =========================================================
-- Fixtures
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000002701',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'usage-owner@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000002702',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'usage-outsider@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000002703',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'usage-suspended@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000002711',
  'Usage Organization A',
  'usage-org-a-027'
),
(
  '00000000-0000-4000-8000-000000002712',
  'Usage Organization B',
  'usage-org-b-027'
);

insert into public.organization_members (
  organization_id, user_id, role, status
)
values
(
  '00000000-0000-4000-8000-000000002711',
  '00000000-0000-4000-8000-000000002701',
  'owner',
  'active'
),
(
  '00000000-0000-4000-8000-000000002712',
  '00000000-0000-4000-8000-000000002702',
  'owner',
  'active'
),
(
  '00000000-0000-4000-8000-000000002711',
  '00000000-0000-4000-8000-000000002703',
  'member',
  'suspended'
);

insert into public.customers (organization_id, name)
values
(
  '00000000-0000-4000-8000-000000002711',
  'Usage Customer A'
),
(
  '00000000-0000-4000-8000-000000002711',
  'Usage Customer B'
);

insert into public.leads (organization_id, name)
values (
  '00000000-0000-4000-8000-000000002711',
  'Usage Lead'
);

-- =========================================================
-- Authenticated owner
-- =========================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002701',
  true
);

-- Test 1: RPC returns five resources.
select is(
  (
    select count(*)::integer
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
  ),
  5,
  'Owner receives five resource usage rows'
);

-- Test 2: Correct plan.
select is(
  (
    select distinct plan_id
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
  ),
  'free',
  'Owner receives the Free plan'
);

-- Test 3: Correct customer usage.
select is(
  (
    select used
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
    where resource = 'customers'
  ),
  2::bigint,
  'Customer usage is counted correctly'
);

-- Test 4: Correct customer limit.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
    where resource = 'customers'
  ),
  25,
  'Free customer limit is reported correctly'
);

-- Test 5: Suspended members do not count as active seats.
select is(
  (
    select used
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
    where resource = 'members'
  ),
  1::bigint,
  'Only active members count toward seat usage'
);

-- Test 6: Correct lead usage.
select is(
  (
    select used
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
    where resource = 'leads'
  ),
  1::bigint,
  'Lead usage is counted correctly'
);

-- =========================================================
-- Cross-organization security
-- =========================================================

-- Test 7: Owner cannot read another organization's usage.
select throws_ok(
  $$
    select *
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002712'
    )
  $$,
  '42501',
  'Organization access denied',
  'Cross-organization usage access is rejected'
);

-- =========================================================
-- Suspended member
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002703',
  true
);

-- Test 8: Suspended member cannot read usage.
select throws_ok(
  $$
    select *
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
  $$,
  '42501',
  'Organization access denied',
  'Suspended members cannot read subscription usage'
);

-- =========================================================
-- Starter plan and unlimited resources
-- =========================================================

set local role postgres;

update public.organization_subscriptions
set plan_id = 'starter'
where organization_id =
  '00000000-0000-4000-8000-000000002711';

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002701',
  true
);

-- Test 9: Starter customer limit.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
    where resource = 'customers'
  ),
  500,
  'Starter customer limit is reported correctly'
);

-- Test 10: Unlimited resources return NULL.
select ok(
  (
    select resource_limit is null
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000002711'
    )
    where resource = 'estimates'
  ),
  'Unlimited estimates are represented by NULL'
);

select * from finish();

rollback;
