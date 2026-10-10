begin;

set local search_path = public, extensions;

select plan(8);

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
  '00000000-0000-4000-8000-000000002001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'profiles-owner@test.local', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000002002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'profiles-teammate@test.local', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000002003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'profiles-outsider@test.local', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000002004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'profiles-suspended@test.local', '', now(), now(), now()
);

-- Profiles are automatically created when auth users are inserted.
-- Populate their names instead of inserting duplicate records.

update public.profiles
set first_name = 'Owner',
    last_name = 'Test'
where id = '00000000-0000-4000-8000-000000002001';

update public.profiles
set first_name = 'Teammate',
    last_name = 'Test'
where id = '00000000-0000-4000-8000-000000002002';

update public.profiles
set first_name = 'Outsider',
    last_name = 'Test'
where id = '00000000-0000-4000-8000-000000002003';

update public.profiles
set first_name = 'Suspended',
    last_name = 'Test'
where id = '00000000-0000-4000-8000-000000002004';

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000002011',
  'Profiles Test A',
  'profiles-test-a-020'
),
(
  '00000000-0000-4000-8000-000000002012',
  'Profiles Test B',
  'profiles-test-b-020'
);

-- This test requires multiple active members in Organization A.
update public.organization_subscriptions
set plan_id = 'pro'
where organization_id = '00000000-0000-4000-8000-000000002011';

insert into public.organization_members (
  organization_id, user_id, role, status
)
values
(
  '00000000-0000-4000-8000-000000002011',
  '00000000-0000-4000-8000-000000002001',
  'owner', 'active'
),
(
  '00000000-0000-4000-8000-000000002011',
  '00000000-0000-4000-8000-000000002002',
  'member', 'active'
),
(
  '00000000-0000-4000-8000-000000002012',
  '00000000-0000-4000-8000-000000002003',
  'owner', 'active'
),
(
  '00000000-0000-4000-8000-000000002011',
  '00000000-0000-4000-8000-000000002004',
  'member', 'suspended'
);

-- Authenticate as organization A owner.

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002001',
  true
);

-- =========================================================
-- PROFILE READ ACCESS
-- =========================================================

-- Test 1: User can read their own profile.
select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-4000-8000-000000002001'
  ),
  1,
  'User can read their own profile'
);

-- Test 2: User can read an active teammate.
select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-4000-8000-000000002002'
  ),
  1,
  'User can read active teammate profile'
);

-- Test 3: User cannot read unrelated organization profiles.
select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-4000-8000-000000002003'
  ),
  0,
  'User cannot read unrelated organization profile'
);

-- Test 4: Suspended teammate profile is inaccessible.
select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-4000-8000-000000002004'
  ),
  0,
  'User cannot read suspended teammate profile'
);

-- Test 5: User can see exactly two profiles.
select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002002',
      '00000000-0000-4000-8000-000000002003',
      '00000000-0000-4000-8000-000000002004'
    )
  ),
  2,
  'User sees only own and active teammate profiles'
);

-- =========================================================
-- PROFILE UPDATE ACCESS
-- =========================================================

-- Test 6: User can update their own profile.
select results_eq(
  $$
    update public.profiles
    set first_name = 'Updated'
    where id = '00000000-0000-4000-8000-000000002001'
    returning first_name
  $$,
  $$
    values ('Updated'::text)
  $$,
  'User can update their own profile'
);

-- Test 7: User cannot update a teammate's profile.
select results_eq(
  $$
    update public.profiles
    set first_name = 'Unauthorized'
    where id = '00000000-0000-4000-8000-000000002002'
    returning id
  $$,
  $$
    select id from public.profiles where false
  $$,
  'User cannot update teammate profile'
);

-- =========================================================
-- ANONYMOUS ACCESS
-- =========================================================

set local role anon;

select set_config('request.jwt.claim.sub', '', true);

-- Test 8: Anonymous users cannot read profiles.
select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '00000000-0000-4000-8000-000000002001'
  ),
  0,
  'Anonymous users cannot read profiles'
);

select * from finish();

rollback;