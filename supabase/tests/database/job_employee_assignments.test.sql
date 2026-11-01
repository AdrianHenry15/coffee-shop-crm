BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT no_plan();

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_other_org uuid := gen_random_uuid();

  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();

  v_customer uuid := gen_random_uuid();
  v_other_customer uuid := gen_random_uuid();

  v_job uuid := gen_random_uuid();
  v_second_job uuid := gen_random_uuid();
  v_third_job uuid := gen_random_uuid();
  v_foreign_job uuid := gen_random_uuid();

  v_employee uuid := gen_random_uuid();
  v_second_employee uuid := gen_random_uuid();
  v_inactive_employee uuid := gen_random_uuid();
  v_foreign_employee uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  )
  SELECT
    fixture.id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    fixture.id::text || '@test.local',
    '',
    now(),
    now(),
    now()
  FROM unnest(
    ARRAY[v_owner, v_admin, v_member, v_outsider]
  ) AS fixture(id);

  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (v_org, 'Assignment Test', 'assignment-' || v_org::text),
    (
      v_other_org,
      'Other Assignment Test',
      'assignment-' || v_other_org::text
    );

  UPDATE public.organization_subscriptions
  SET plan_id = 'pro', status = 'active'
  WHERE organization_id IN (v_org, v_other_org);

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status
  )
  VALUES
    (v_org, v_owner, 'owner', 'active'),
    (v_org, v_admin, 'admin', 'active'),
    (v_org, v_member, 'member', 'active'),
    (v_other_org, v_outsider, 'owner', 'active');

  INSERT INTO public.customers (id, organization_id, name)
  VALUES
    (v_customer, v_org, 'Assignment Customer'),
    (v_other_customer, v_other_org, 'Other Assignment Customer');

  INSERT INTO public.jobs (
    id, organization_id, customer_id, title
  )
  VALUES
    (v_job, v_org, v_customer, 'First Job'),
    (v_second_job, v_org, v_customer, 'Second Job'),
    (v_third_job, v_org, v_customer, 'Third Job'),
    (v_foreign_job, v_other_org, v_other_customer, 'Foreign Job');

  INSERT INTO public.employees (
    id, organization_id, name, status
  )
  VALUES
    (v_employee, v_org, 'First Employee', 'active'),
    (v_second_employee, v_org, 'Second Employee', 'active'),
    (v_inactive_employee, v_org, 'Inactive Employee', 'inactive'),
    (v_foreign_employee, v_other_org, 'Foreign Employee', 'active');

  INSERT INTO public.job_employee_assignments (
    organization_id, job_id, employee_id
  )
  VALUES (v_other_org, v_foreign_job, v_foreign_employee);

  PERFORM set_config('test.assign_org', v_org::text, true);
  PERFORM set_config('test.assign_other_org', v_other_org::text, true);
  PERFORM set_config('test.assign_owner', v_owner::text, true);
  PERFORM set_config('test.assign_admin', v_admin::text, true);
  PERFORM set_config('test.assign_member', v_member::text, true);
  PERFORM set_config('test.assign_outsider', v_outsider::text, true);
  PERFORM set_config('test.assign_job', v_job::text, true);
  PERFORM set_config('test.assign_second_job', v_second_job::text, true);
  PERFORM set_config('test.assign_third_job', v_third_job::text, true);
  PERFORM set_config('test.assign_foreign_job', v_foreign_job::text, true);
  PERFORM set_config('test.assign_employee', v_employee::text, true);
  PERFORM set_config(
    'test.assign_second_employee', v_second_employee::text, true
  );
  PERFORM set_config(
    'test.assign_inactive_employee', v_inactive_employee::text, true
  );
  PERFORM set_config(
    'test.assign_foreign_employee', v_foreign_employee::text, true
  );
END;
$$;

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT * FROM public.job_employee_assignments $$,
  '42501', NULL,
  'Anonymous users cannot read assignments'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.assign_owner'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.job_employee_assignments),
  0::bigint,
  'An owner cannot see another workspace assignments'
);

SELECT lives_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_job')::uuid,
      current_setting('test.assign_employee')::uuid
    )
  $$,
  'An owner can assign an employee without a login account'
);

SELECT lives_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_job')::uuid,
      current_setting('test.assign_second_employee')::uuid
    )
  $$,
  'A job can have multiple employees'
);

SELECT lives_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_second_job')::uuid,
      current_setting('test.assign_employee')::uuid
    )
  $$,
  'An employee can be assigned to multiple jobs'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_job')::uuid,
      current_setting('test.assign_employee')::uuid
    )
  $$,
  '23505', NULL,
  'Duplicate employee-job assignments are rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_job')::uuid,
      current_setting('test.assign_foreign_employee')::uuid
    )
  $$,
  '23514', 'Choose an active employee from this workspace',
  'An employee from another workspace cannot be assigned'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_foreign_job')::uuid,
      current_setting('test.assign_employee')::uuid
    )
  $$,
  '23503', NULL,
  'An assignment cannot reference another workspace job'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_job')::uuid,
      current_setting('test.assign_inactive_employee')::uuid
    )
  $$,
  '23514', 'Choose an active employee from this workspace',
  'Inactive employees cannot receive new assignments'
);

SELECT throws_ok(
  $$
    UPDATE public.job_employee_assignments
    SET job_id = current_setting('test.assign_third_job')::uuid
    WHERE job_id = current_setting('test.assign_job')::uuid
  $$,
  '42501', NULL,
  'Assignments cannot be rewritten through direct updates'
);

-- Admins can read and remove assignments.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.assign_admin'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.job_employee_assignments),
  3::bigint,
  'Admins can read their workspace assignments'
);

WITH removed AS (
  DELETE FROM public.job_employee_assignments
  WHERE job_id = current_setting('test.assign_job')::uuid
    AND employee_id = current_setting('test.assign_second_employee')::uuid
  RETURNING job_id
)
SELECT is(
  (SELECT count(*) FROM removed),
  1::bigint,
  'Admins can unassign an employee'
);

SELECT lives_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_third_job')::uuid,
      current_setting('test.assign_second_employee')::uuid
    )
  $$,
  'Admins can assign employees'
);

-- Ordinary members have no assignment-management access.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.assign_member'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.job_employee_assignments),
  0::bigint,
  'Ordinary members cannot read assignment lists'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_job')::uuid,
      current_setting('test.assign_second_employee')::uuid
    )
  $$,
  '23514', 'Choose an active employee from this workspace',
  'Ordinary members cannot assign employees hidden by employee RLS'
);

WITH removed AS (
  DELETE FROM public.job_employee_assignments
  WHERE job_id = current_setting('test.assign_job')::uuid
  RETURNING job_id
)
SELECT is(
  (SELECT count(*) FROM removed),
  0::bigint,
  'Ordinary members cannot remove assignments'
);

-- Ownership of another workspace does not grant access here.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.assign_outsider'),
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.job_employee_assignments
    WHERE organization_id = current_setting('test.assign_org')::uuid
  ),
  0::bigint,
  'Another workspace owner cannot read these assignments'
);

WITH removed AS (
  DELETE FROM public.job_employee_assignments
  WHERE organization_id = current_setting('test.assign_org')::uuid
  RETURNING job_id
)
SELECT is(
  (SELECT count(*) FROM removed),
  0::bigint,
  'Another workspace owner cannot remove these assignments'
);

-- Deactivation preserves existing assignments.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.assign_owner'),
  true
);

UPDATE public.employees
SET status = 'inactive'
WHERE id = current_setting('test.assign_employee')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.job_employee_assignments
    WHERE employee_id = current_setting('test.assign_employee')::uuid
  ),
  2::bigint,
  'Employee deactivation preserves existing assignments'
);

SELECT throws_ok(
  $$
    INSERT INTO public.job_employee_assignments (
      organization_id, job_id, employee_id
    )
    VALUES (
      current_setting('test.assign_org')::uuid,
      current_setting('test.assign_third_job')::uuid,
      current_setting('test.assign_employee')::uuid
    )
  $$,
  '23514', 'Choose an active employee from this workspace',
  'A deactivated employee cannot receive another assignment'
);

-- Deleting a job clears only its assignments.
DELETE FROM public.jobs
WHERE id = current_setting('test.assign_job')::uuid
  AND organization_id = current_setting('test.assign_org')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.job_employee_assignments
    WHERE job_id = current_setting('test.assign_job')::uuid
  ),
  0::bigint,
  'Deleting a job removes its assignments'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.job_employee_assignments
    WHERE job_id = current_setting('test.assign_second_job')::uuid
  ),
  1::bigint,
  'Deleting one job preserves assignments on other jobs'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = current_setting('test.assign_employee')::uuid
  ),
  'Deleting a job preserves the employee record'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.organization_members
    WHERE organization_id = current_setting('test.assign_org')::uuid
      AND status = 'active'
  ),
  3::bigint,
  'Employee assignments do not create login memberships'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;