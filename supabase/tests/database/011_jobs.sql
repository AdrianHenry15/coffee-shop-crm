
begin;

set local search_path = public, extensions;

select plan(12);

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
  '00000000-0000-4000-8000-000000001101',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'jobs-a@example.com', '', now(), now(), now()
),
(
  '00000000-0000-4000-8000-000000001102',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'jobs-b@example.com', '', now(), now(), now()
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000001111',
  'Jobs Test A', 'jobs-test-a-011'
),
(
  '00000000-0000-4000-8000-000000001112',
  'Jobs Test B', 'jobs-test-b-011'
);

insert into public.organization_members (
  organization_id, user_id, role
)
values
(
  '00000000-0000-4000-8000-000000001111',
  '00000000-0000-4000-8000-000000001101',
  'owner'
),
(
  '00000000-0000-4000-8000-000000001112',
  '00000000-0000-4000-8000-000000001102',
  'owner'
);

insert into public.customers (
  id, organization_id, name
)
values
(
  '00000000-0000-4000-8000-000000001121',
  '00000000-0000-4000-8000-000000001111',
  'Jobs Customer A'
),
(
  '00000000-0000-4000-8000-000000001122',
  '00000000-0000-4000-8000-000000001112',
  'Jobs Customer B'
);

insert into public.estimates (
  id, organization_id, customer_id, status
)
values
(
  '00000000-0000-4000-8000-000000001131',
  '00000000-0000-4000-8000-000000001111',
  '00000000-0000-4000-8000-000000001121',
  'accepted'
),
(
  '00000000-0000-4000-8000-000000001132',
  '00000000-0000-4000-8000-000000001111',
  '00000000-0000-4000-8000-000000001121',
  'draft'
),
(
  '00000000-0000-4000-8000-000000001133',
  '00000000-0000-4000-8000-000000001112',
  '00000000-0000-4000-8000-000000001122',
  'accepted'
);

-- Authenticate as User A.
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001101',
  true
);

-- =========================================================
-- BASIC JOB OPERATIONS
-- =========================================================

-- Test 1: Create job without estimate.
select lives_ok(
  $$
    insert into public.jobs (
      id, organization_id, customer_id, title
    )
    values (
      '00000000-0000-4000-8000-000000001141',
      '00000000-0000-4000-8000-000000001111',
      '00000000-0000-4000-8000-000000001121',
      'Window Cleaning'
    )
  $$,
  'Member can create a job without an estimate'
);

-- Test 2: Member can read job.
select is(
  (
    select title
    from public.jobs
    where id = '00000000-0000-4000-8000-000000001141'
  ),
  'Window Cleaning',
  'Member can read their job'
);

-- Test 3: Member can update job.
select lives_ok(
  $$
    update public.jobs
    set title = 'Updated Window Cleaning'
    where id = '00000000-0000-4000-8000-000000001141'
  $$,
  'Member can update their job'
);

-- =========================================================
-- TENANT ISOLATION
-- =========================================================

-- Test 4: Cannot create job for Organization B.
select throws_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id, title
    )
    values (
      '00000000-0000-4000-8000-000000001112',
      '00000000-0000-4000-8000-000000001122',
      'Unauthorized Job'
    )
  $$,
  '42501'
);

-- Test 5: Cannot reference another organization's customer.
select throws_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id, title
    )
    values (
      '00000000-0000-4000-8000-000000001111',
      '00000000-0000-4000-8000-000000001122',
      'Cross Tenant Customer'
    )
  $$,
  '23503'
);

-- =========================================================
-- ESTIMATE VALIDATION
-- =========================================================

-- Test 6: Accepted estimate can be linked.
select lives_ok(
  $$
    insert into public.jobs (
      id, organization_id, customer_id,
      estimate_id, title
    )
    values (
      '00000000-0000-4000-8000-000000001142',
      '00000000-0000-4000-8000-000000001111',
      '00000000-0000-4000-8000-000000001121',
      '00000000-0000-4000-8000-000000001131',
      'Accepted Estimate Job'
    )
  $$,
  'Accepted estimate can be linked to a job'
);

-- Test 7: Draft estimate cannot be linked.
select throws_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id,
      estimate_id, title
    )
    values (
      '00000000-0000-4000-8000-000000001111',
      '00000000-0000-4000-8000-000000001121',
      '00000000-0000-4000-8000-000000001132',
      'Draft Estimate Job'
    )
  $$,
  'P0001'
);

-- Test 8: An estimate cannot produce two jobs.
select throws_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id,
      estimate_id, title
    )
    values (
      '00000000-0000-4000-8000-000000001111',
      '00000000-0000-4000-8000-000000001121',
      '00000000-0000-4000-8000-000000001131',
      'Duplicate Estimate Job'
    )
  $$,
  '23505'
);

-- =========================================================
-- SCHEDULING AND COMPLETION
-- =========================================================

-- Test 9: Invalid schedule is rejected.
select throws_ok(
  $$
    insert into public.jobs (
      organization_id, customer_id, title,
      scheduled_start, scheduled_end
    )
    values (
      '00000000-0000-4000-8000-000000001111',
      '00000000-0000-4000-8000-000000001121',
      'Invalid Schedule',
      '2026-10-20 15:00:00+00',
      '2026-10-20 12:00:00+00'
    )
  $$,
  '23514'
);

-- Test 10: Completing a job sets completed_at.
select lives_ok(
  $$
    update public.jobs
    set status = 'completed'
    where id = '00000000-0000-4000-8000-000000001141'
  $$,
  'Job can be marked completed'
);

-- Test 11: Completion timestamp was recorded.
select ok(
  (
    select completed_at is not null
    from public.jobs
    where id = '00000000-0000-4000-8000-000000001141'
  ),
  'Completed job has completion timestamp'
);

-- Test 12: Reopening a job clears completed_at.
select lives_ok(
  $$
    update public.jobs
    set status = 'scheduled'
    where id = '00000000-0000-4000-8000-000000001141'
  $$,
  'Completed job can be reopened'
);

select * from finish();

rollback;
