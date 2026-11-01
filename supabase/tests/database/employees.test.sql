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
  v_member_membership uuid;
  v_foreign_membership uuid;
  v_employee uuid := gen_random_uuid();
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
    (v_org, 'Employees Test', 'employees-' || v_org::text),
    (
      v_other_org,
      'Other Employees Test',
      'employees-' || v_other_org::text
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

  SELECT id INTO v_member_membership
  FROM public.organization_members
  WHERE organization_id = v_org AND user_id = v_member;

  SELECT id INTO v_foreign_membership
  FROM public.organization_members
  WHERE organization_id = v_other_org AND user_id = v_outsider;

  INSERT INTO public.employees (
    id, organization_id, name, membership_id
  )
  VALUES
    (v_employee, v_org, 'Linked Employee', v_member_membership),
    (
      v_foreign_employee,
      v_other_org,
      'Foreign Employee',
      v_foreign_membership
    );

  PERFORM set_config('test.emp_org', v_org::text, true);
  PERFORM set_config('test.emp_other_org', v_other_org::text, true);
  PERFORM set_config('test.emp_owner', v_owner::text, true);
  PERFORM set_config('test.emp_admin', v_admin::text, true);
  PERFORM set_config('test.emp_member', v_member::text, true);
  PERFORM set_config('test.emp_outsider', v_outsider::text, true);
  PERFORM set_config('test.emp_record', v_employee::text, true);
  PERFORM set_config(
    'test.emp_foreign_record', v_foreign_employee::text, true
  );
  PERFORM set_config(
    'test.emp_membership', v_member_membership::text, true
  );
  PERFORM set_config(
    'test.emp_foreign_membership', v_foreign_membership::text, true
  );
END;
$$;

-- Anonymous access is denied.
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT * FROM public.employees $$,
  '42501', NULL,
  'Anonymous users cannot read employee records'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.emp_owner'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.employees),
  1::bigint,
  'Owners see only their workspace employee records'
);

SELECT lives_ok(
  $$
    INSERT INTO public.employees (
      organization_id, name, email, phone, job_title
    )
    VALUES (
      current_setting('test.emp_org')::uuid,
      'No Account Needed',
      'staff-record@test.local',
      '555-0100',
      'Technician'
    )
  $$,
  'An owner can add an employee without a login account'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.organization_members
    WHERE organization_id = current_setting('test.emp_org')::uuid
  ),
  3::bigint,
  'Adding an employee does not create a membership or consume a seat'
);

SELECT throws_ok(
  $$
    INSERT INTO public.employees (organization_id, name)
    VALUES (
      current_setting('test.emp_other_org')::uuid,
      'Unauthorized Employee'
    )
  $$,
  '42501', NULL,
  'Owners cannot insert employees into another workspace'
);

WITH changed AS (
  UPDATE public.employees
  SET name = 'Unauthorized Change'
  WHERE id = current_setting('test.emp_foreign_record')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Owners cannot update another workspace employee'
);

SELECT throws_ok(
  $$
    UPDATE public.employees
    SET organization_id = current_setting('test.emp_other_org')::uuid
    WHERE id = current_setting('test.emp_record')::uuid
  $$,
  '23514', 'Employee identity and workspace cannot be changed',
  'Employee records cannot be moved between workspaces'
);

SELECT throws_ok(
  $$
    INSERT INTO public.employees (
      organization_id, name, membership_id
    )
    VALUES (
      current_setting('test.emp_org')::uuid,
      'Invalid Link',
      current_setting('test.emp_foreign_membership')::uuid
    )
  $$,
  '23514',
  'Employee links require an active membership in the same workspace',
  'Employee records cannot link to another workspace membership'
);

SELECT throws_ok(
  $$
    INSERT INTO public.employees (
      organization_id, name, membership_id
    )
    VALUES (
      current_setting('test.emp_org')::uuid,
      'Duplicate Link',
      current_setting('test.emp_membership')::uuid
    )
  $$,
  '23505', NULL,
  'One membership cannot link to multiple employee records'
);

SELECT throws_ok(
  $$
    INSERT INTO public.employees (organization_id, name)
    VALUES (current_setting('test.emp_org')::uuid, '   ')
  $$,
  '23514', NULL,
  'Blank employee names are rejected'
);

SELECT throws_ok(
  $$
    DELETE FROM public.employees
    WHERE id = current_setting('test.emp_record')::uuid
  $$,
  '42501', NULL,
  'Browser users cannot permanently delete employee records'
);

-- Admins can manage staff records.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.emp_admin'),
  true
);

WITH changed AS (
  UPDATE public.employees
  SET job_title = 'Lead Technician'
  WHERE id = current_setting('test.emp_record')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'Admins can update employee details'
);

SELECT lives_ok(
  $$
    INSERT INTO public.employees (organization_id, name)
    VALUES (
      current_setting('test.emp_org')::uuid,
      'Admin Added Employee'
    )
  $$,
  'Admins can add employee records'
);

WITH changed AS (
  UPDATE public.employees
  SET status = 'inactive'
  WHERE id = current_setting('test.emp_record')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'Admins can mark an employee inactive'
);

SELECT is(
  (
    SELECT status
    FROM public.organization_members
    WHERE id = current_setting('test.emp_membership')::uuid
  ),
  'active',
  'An inactive employee record does not suspend login access'
);

-- Ordinary members cannot read private staff contact details.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.emp_member'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.employees),
  0::bigint,
  'Ordinary members cannot read the employee directory'
);

SELECT throws_ok(
  $$
    INSERT INTO public.employees (organization_id, name)
    VALUES (
      current_setting('test.emp_org')::uuid,
      'Unauthorized Employee'
    )
  $$,
  '42501', NULL,
  'Ordinary members cannot add employees'
);

WITH changed AS (
  UPDATE public.employees
  SET job_title = 'Unauthorized Change'
  WHERE id = current_setting('test.emp_record')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Ordinary members cannot update employee records'
);

-- Suspending membership preserves the employee record and its link.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.emp_owner'),
  true
);

SELECT public.update_organization_member(
  current_setting('test.emp_org')::uuid,
  current_setting('test.emp_membership')::uuid,
  'member',
  'suspended'
);

SELECT is(
  (
    SELECT membership_id
    FROM public.employees
    WHERE id = current_setting('test.emp_record')::uuid
  ),
  current_setting('test.emp_membership')::uuid,
  'Suspending membership preserves the existing employee link'
);

-- Unlinking is allowed, but linking a suspended member is not.
UPDATE public.employees
SET membership_id = NULL
WHERE id = current_setting('test.emp_record')::uuid;

SELECT throws_ok(
  $$
    UPDATE public.employees
    SET membership_id = current_setting('test.emp_membership')::uuid
    WHERE id = current_setting('test.emp_record')::uuid
  $$,
  '23514',
  'Employee links require an active membership in the same workspace',
  'New links to suspended memberships are rejected'
);

SELECT public.update_organization_member(
  current_setting('test.emp_org')::uuid,
  current_setting('test.emp_membership')::uuid,
  'member',
  'active'
);

UPDATE public.employees
SET membership_id = current_setting('test.emp_membership')::uuid
WHERE id = current_setting('test.emp_record')::uuid;

-- Removing access clears the link without removing staff history.
SELECT lives_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.emp_org')::uuid,
      current_setting('test.emp_membership')::uuid
    )
  $$,
  'A membership linked to an employee can be removed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.employees
    WHERE id = current_setting('test.emp_record')::uuid
      AND membership_id IS NULL
  ),
  'Membership removal preserves the employee and clears its link'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = current_setting('test.emp_member')::uuid
  ),
  'Membership removal preserves the login account'
);

SELECT * FROM finish();
ROLLBACK;