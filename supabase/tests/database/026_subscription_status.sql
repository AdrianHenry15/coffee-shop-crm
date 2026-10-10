
begin;

select plan(9);

-- =========================================================
-- Setup
-- =========================================================

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000002601',
  'Subscription Status Test',
  'subscription-status-test-026'
);

-- =========================================================
-- Active subscription
-- =========================================================

-- Test 1: New organizations start active.
select is(
  (
    select status
    from public.organization_subscriptions
    where organization_id =
      '00000000-0000-4000-8000-000000002601'
  ),
  'active',
  'New organizations have active subscriptions'
);

-- Test 2: Active subscriptions allow creation.
select lives_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002601',
      'Active Lead'
    )
  $$,
  'Active subscriptions allow new leads'
);

-- =========================================================
-- Trialing subscription
-- =========================================================

update public.organization_subscriptions
set status = 'trialing'
where organization_id =
  '00000000-0000-4000-8000-000000002601';

-- Test 3: Trialing subscriptions allow creation.
select lives_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002601',
      'Trialing Lead'
    )
  $$,
  'Trialing subscriptions allow new leads'
);

-- =========================================================
-- Past due subscription
-- =========================================================

update public.organization_subscriptions
set status = 'past_due'
where organization_id =
  '00000000-0000-4000-8000-000000002601';

-- Test 4: Past due subscriptions block creation.
select throws_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002601',
      'Past Due Lead'
    )
  $$,
  'P0001',
  'Organization subscription is not active',
  'Past due subscriptions reject new leads'
);

-- =========================================================
-- Canceled subscription
-- =========================================================

update public.organization_subscriptions
set status = 'canceled'
where organization_id =
  '00000000-0000-4000-8000-000000002601';

-- Test 5: Canceled subscriptions block creation.
select throws_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002601',
      'Canceled Lead'
    )
  $$,
  'P0001',
  'Organization subscription is not active',
  'Canceled subscriptions reject new leads'
);

-- =========================================================
-- Unpaid subscription
-- =========================================================

update public.organization_subscriptions
set status = 'unpaid'
where organization_id =
  '00000000-0000-4000-8000-000000002601';

-- Test 6: Unpaid subscriptions block creation.
select throws_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002601',
      'Unpaid Lead'
    )
  $$,
  'P0001',
  'Organization subscription is not active',
  'Unpaid subscriptions reject new leads'
);

-- =========================================================
-- Existing records remain accessible
-- =========================================================

-- Test 7: Existing leads remain in the database.
select is(
  (
    select count(*)::integer
    from public.leads
    where organization_id =
      '00000000-0000-4000-8000-000000002601'
  ),
  2,
  'Inactive subscriptions preserve existing leads'
);

-- =========================================================
-- Reactivation
-- =========================================================

update public.organization_subscriptions
set status = 'active'
where organization_id =
  '00000000-0000-4000-8000-000000002601';

-- Test 8: Reactivated subscriptions allow creation.
select lives_ok(
  $$
    insert into public.leads (organization_id, name)
    values (
      '00000000-0000-4000-8000-000000002601',
      'Reactivated Lead'
    )
  $$,
  'Reactivated subscriptions allow new leads'
);

-- Test 9: Usage resumes correctly.
select is(
  (
    select count(*)::integer
    from public.leads
    where organization_id =
      '00000000-0000-4000-8000-000000002601'
  ),
  3,
  'Reactivation preserves existing records and adds new ones'
);

select * from finish();

rollback;
