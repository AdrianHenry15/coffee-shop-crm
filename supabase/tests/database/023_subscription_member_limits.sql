begin;

select plan(8);

-- =========================================================
-- Setup
-- =========================================================

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000002301',
  'Member Limits Test',
  'member-limits-test-023'
);

-- Create five test users.
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at
)
select
  ('00000000-0000-4000-8000-' ||
    lpad(number::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'member-limit-' || number || '@test.local',
  '',
  now(),
  now(),
  now()
from generate_series(2301, 2305) as number;

-- =========================================================
-- Free: one active member
-- =========================================================

insert into public.organization_members (
  organization_id, user_id, role, status
)
values (
  '00000000-0000-4000-8000-000000002301',
  '00000000-0000-4000-8000-000000002301',
  'owner',
  'active'
);

select is(
  (
    select count(*)::integer
    from public.organization_members
    where organization_id =
      '00000000-0000-4000-8000-000000002301'
      and status = 'active'
  ),
  1,
  'Free allows one active member'
);

-- Invited members do not consume active seats.
select lives_ok(
  $$
    insert into public.organization_members (
      organization_id, user_id, role, status
    )
    values (
      '00000000-0000-4000-8000-000000002301',
      '00000000-0000-4000-8000-000000002302',
      'member',
      'invited'
    )
  $$,
  'Free allows an invited member'
);

-- Suspended members do not consume active seats.
select lives_ok(
  $$
    insert into public.organization_members (
      organization_id, user_id, role, status
    )
    values (
      '00000000-0000-4000-8000-000000002301',
      '00000000-0000-4000-8000-000000002303',
      'member',
      'suspended'
    )
  $$,
  'Free allows a suspended member'
);

-- Invited member cannot activate when the seat is occupied.
select throws_ok(
  $$
    update public.organization_members
    set status = 'active'
    where organization_id =
      '00000000-0000-4000-8000-000000002301'
      and user_id =
      '00000000-0000-4000-8000-000000002302'
  $$,
  'P0001',
  'Subscription limit reached for organization_members',
  'Free rejects activation of a second member'
);

-- =========================================================
-- Starter: three active members
-- =========================================================

update public.organization_subscriptions
set plan_id = 'starter'
where organization_id =
  '00000000-0000-4000-8000-000000002301';

select lives_ok(
  $$
    update public.organization_members
    set status = 'active'
    where organization_id =
      '00000000-0000-4000-8000-000000002301'
      and user_id =
      '00000000-0000-4000-8000-000000002302'
  $$,
  'Starter allows activation of a second member'
);

select lives_ok(
  $$
    update public.organization_members
    set status = 'active'
    where organization_id =
      '00000000-0000-4000-8000-000000002301'
      and user_id =
      '00000000-0000-4000-8000-000000002303'
  $$,
  'Starter allows activation of a third member'
);

select throws_ok(
  $$
    insert into public.organization_members (
      organization_id, user_id, role, status
    )
    values (
      '00000000-0000-4000-8000-000000002301',
      '00000000-0000-4000-8000-000000002304',
      'member',
      'active'
    )
  $$,
  'P0001',
  'Subscription limit reached for organization_members',
  'Starter rejects a fourth active member'
);

-- =========================================================
-- Pro: ten active members
-- =========================================================

update public.organization_subscriptions
set plan_id = 'pro'
where organization_id =
  '00000000-0000-4000-8000-000000002301';

select lives_ok(
  $$
    insert into public.organization_members (
      organization_id, user_id, role, status
    )
    values (
      '00000000-0000-4000-8000-000000002301',
      '00000000-0000-4000-8000-000000002304',
      'member',
      'active'
    )
  $$,
  'Pro allows additional active members'
);

select * from finish();

rollback;