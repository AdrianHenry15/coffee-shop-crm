begin;

set local search_path = public, extensions;

select plan(6);

-- =========================================================
-- SETUP
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at
)
values
(
  '00000000-0000-4000-8000-000000002101',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'billing-a@test.local', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000002102',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'billing-b@test.local', '', now(), now(), now()
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000002111',
  'Billing Test A',
  'billing-test-a-021'
),
(
  '00000000-0000-4000-8000-000000002112',
  'Billing Test B',
  'billing-test-b-021'
);

insert into public.organization_members (
  organization_id, user_id, role
)
values
(
  '00000000-0000-4000-8000-000000002111',
  '00000000-0000-4000-8000-000000002101',
  'owner'
),
(
  '00000000-0000-4000-8000-000000002112',
  '00000000-0000-4000-8000-000000002102',
  'owner'
);

-- =========================================================
-- AUTOMATIC SUBSCRIPTIONS
-- =========================================================

-- Test 1: New organizations receive Free automatically.
select is(
  (
    select plan_id
    from public.organization_subscriptions
    where organization_id =
      '00000000-0000-4000-8000-000000002111'
  ),
  'free',
  'New organization receives Free plan'
);

-- Test 2: Another organization receives its own subscription.
select is(
  (
    select count(*)::integer
    from public.organization_subscriptions
    where organization_id =
      '00000000-0000-4000-8000-000000002112'
  ),
  1,
  'Each organization receives a subscription'
);

-- =========================================================
-- AUTHENTICATED ACCESS
-- =========================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002101',
  true
);

-- Test 3: User can read their subscription.
select is(
  (
    select count(*)::integer
    from public.organization_subscriptions
    where organization_id =
      '00000000-0000-4000-8000-000000002111'
  ),
  1,
  'Member can read their organization subscription'
);

-- Test 4: Cross-tenant subscriptions are hidden.
select is(
  (
    select count(*)::integer
    from public.organization_subscriptions
    where organization_id =
      '00000000-0000-4000-8000-000000002112'
  ),
  0,
  'Member cannot read another organization subscription'
);

-- Test 5: User cannot upgrade themselves.
select results_eq(
  $$
    update public.organization_subscriptions
    set plan_id = 'pro'
    where organization_id =
      '00000000-0000-4000-8000-000000002111'
    returning plan_id
  $$,
  $$
    select plan_id
    from public.organization_subscriptions
    where false
  $$,
  'Member cannot modify subscription plan'
);

-- Test 6: User cannot create subscriptions directly.
select throws_ok(
  $$
    insert into public.organization_subscriptions (
      organization_id, plan_id
    )
    values (
      '00000000-0000-4000-8000-000000002112',
      'pro'
    )
  $$,
  '42501'
);

select * from finish();

rollback;