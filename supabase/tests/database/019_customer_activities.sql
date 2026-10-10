begin;

set local search_path = public, extensions;

select plan(13);

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
  '00000000-0000-4000-8000-000000001901',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'activities-a@test.local', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000001902',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'activities-b@test.local', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000001903',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'activities-colleague@test.local', '', now(), now(), now()
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000001911',
  'Activities Test A',
  'activities-test-a-019'
),
(
  '00000000-0000-4000-8000-000000001912',
  'Activities Test B',
  'activities-test-b-019'
);

-- Allow multiple team members in this security test.
update public.organization_subscriptions
set plan_id = 'pro'
where organization_id = '00000000-0000-4000-8000-000000001911';

insert into public.organization_members (
  organization_id, user_id, role
)
values
(
  '00000000-0000-4000-8000-000000001911',
  '00000000-0000-4000-8000-000000001901',
  'owner'
),
(
  '00000000-0000-4000-8000-000000001912',
  '00000000-0000-4000-8000-000000001902',
  'owner'
),
(
  '00000000-0000-4000-8000-000000001911',
  '00000000-0000-4000-8000-000000001903',
  'member'
);

insert into public.customers (
  id, organization_id, name
)
values
(
  '00000000-0000-4000-8000-000000001921',
  '00000000-0000-4000-8000-000000001911',
  'Activities Customer A'
),
(
  '00000000-0000-4000-8000-000000001922',
  '00000000-0000-4000-8000-000000001912',
  'Activities Customer B'
);

-- Seed activities as database administrator.
insert into public.customer_activities (
  id, organization_id, customer_id,
  created_by, type, content
)
values
(
  '00000000-0000-4000-8000-000000001931',
  '00000000-0000-4000-8000-000000001911',
  '00000000-0000-4000-8000-000000001921',
  '00000000-0000-4000-8000-000000001901',
  'note', 'User A activity'
),
(
  '00000000-0000-4000-8000-000000001932',
  '00000000-0000-4000-8000-000000001912',
  '00000000-0000-4000-8000-000000001922',
  '00000000-0000-4000-8000-000000001902',
  'note', 'User B activity'
),
(
  '00000000-0000-4000-8000-000000001933',
  '00000000-0000-4000-8000-000000001911',
  '00000000-0000-4000-8000-000000001921',
  '00000000-0000-4000-8000-000000001903',
  'call', 'Colleague activity'
);

-- Authenticate as User A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001901',
  true
);

-- =========================================================
-- READ ACCESS
-- =========================================================

-- Test 1: Member can read own organization's activities.
select is(
  (
    select count(*)::integer
    from public.customer_activities
    where organization_id =
      '00000000-0000-4000-8000-000000001911'
  ),
  2,
  'Member can read organization activities'
);

-- Test 2: Cross-tenant activities are invisible.
select is(
  (
    select count(*)::integer
    from public.customer_activities
    where organization_id =
      '00000000-0000-4000-8000-000000001912'
  ),
  0,
  'Member cannot read another organization activities'
);

-- =========================================================
-- CREATE ACCESS
-- =========================================================

-- Test 3: Member can create their own activity.
select lives_ok(
  $$
    insert into public.customer_activities (
      id, organization_id, customer_id,
      created_by, type, content
    )
    values (
      '00000000-0000-4000-8000-000000001934',
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001921',
      '00000000-0000-4000-8000-000000001901',
      'email', 'Follow-up email recorded'
    )
  $$,
  'Member can create an activity'
);

-- Test 4: Member cannot create for another organization.
select throws_ok(
  $$
    insert into public.customer_activities (
      organization_id, customer_id,
      created_by, type, content
    )
    values (
      '00000000-0000-4000-8000-000000001912',
      '00000000-0000-4000-8000-000000001922',
      '00000000-0000-4000-8000-000000001901',
      'note', 'Unauthorized activity'
    )
  $$,
  '42501'
);

-- Test 5: Member cannot impersonate another author.
select throws_ok(
  $$
    insert into public.customer_activities (
      organization_id, customer_id,
      created_by, type, content
    )
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001921',
      '00000000-0000-4000-8000-000000001903',
      'note', 'Impersonated activity'
    )
  $$,
  '42501'
);

-- Test 6: Cross-tenant customer reference is rejected.
select throws_ok(
  $$
    insert into public.customer_activities (
      organization_id, customer_id,
      created_by, type, content
    )
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001922',
      '00000000-0000-4000-8000-000000001901',
      'note', 'Wrong customer organization'
    )
  $$,
  '23503'
);

-- =========================================================
-- VALIDATION
-- =========================================================

-- Test 7: Invalid activity type is rejected.
select throws_ok(
  $$
    insert into public.customer_activities (
      organization_id, customer_id,
      created_by, type, content
    )
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001921',
      '00000000-0000-4000-8000-000000001901',
      'sms', 'Invalid activity type'
    )
  $$,
  '23514'
);

-- Test 8: Empty content is rejected.
select throws_ok(
  $$
    insert into public.customer_activities (
      organization_id, customer_id,
      created_by, type, content
    )
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001921',
      '00000000-0000-4000-8000-000000001901',
      'note', '   '
    )
  $$,
  '23514'
);

-- =========================================================
-- UPDATE AND DELETE ACCESS
-- =========================================================

-- Test 9: An UPDATE must not modify activity content.
select lives_ok(
  $$
    update public.customer_activities
    set content = 'Modified activity'
    where id = '00000000-0000-4000-8000-000000001931'
  $$,
  'Unauthorized update statement does not fail'
);

-- Test 10: Verify the activity was not modified.
select is(
  (
    select content
    from public.customer_activities
    where id = '00000000-0000-4000-8000-000000001931'
  ),
  'User A activity',
  'Activity content remains unchanged'
);

-- Test 11: Another author's activity cannot be deleted.
select results_eq(
  $$
    delete from public.customer_activities
    where id = '00000000-0000-4000-8000-000000001933'
    returning id
  $$,
  $$
    select id
    from public.customer_activities
    where false
  $$,
  'Cannot delete another author activity'
);

-- Test 12: Member can delete their own activity.
select results_eq(
  $$
    delete from public.customer_activities
    where id = '00000000-0000-4000-8000-000000001931'
    returning id
  $$,
  $$
    select '00000000-0000-4000-8000-000000001931'::uuid
  $$,
  'Member can delete their own activity'
);

-- Test 13: Members cannot delete another organization's activities.
select results_eq(
  $$
    delete from public.customer_activities
    where id = '00000000-0000-4000-8000-000000001932'
    returning id
  $$,
  $$
    select id
    from public.customer_activities
    where false
  $$,
  'Member cannot delete another organization activity'
);

select * from finish();

rollback;