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
  v_archived_customer uuid := gen_random_uuid();
  v_other_customer uuid := gen_random_uuid();

  v_job uuid := gen_random_uuid();
  v_other_job uuid := gen_random_uuid();
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
    (v_org, 'Permissions Test', 'permissions-' || v_org::text),
    (
      v_other_org,
      'Other Permissions Test',
      'permissions-' || v_other_org::text
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

  INSERT INTO public.customers (
    id, organization_id, name, deleted_at
  )
  VALUES
    (v_customer, v_org, 'Live Customer', NULL),
    (v_archived_customer, v_org, 'Archived Customer', now()),
    (v_other_customer, v_other_org, 'Other Customer', NULL);

  INSERT INTO public.jobs (
    id, organization_id, customer_id, title
  )
  VALUES
    (v_job, v_org, v_customer, 'Permissions Job'),
    (v_other_job, v_other_org, v_other_customer, 'Other Job');

  PERFORM set_config('test.perm_org', v_org::text, true);
  PERFORM set_config('test.perm_other_org', v_other_org::text, true);
  PERFORM set_config('test.perm_owner', v_owner::text, true);
  PERFORM set_config('test.perm_admin', v_admin::text, true);
  PERFORM set_config('test.perm_member', v_member::text, true);
  PERFORM set_config('test.perm_customer', v_customer::text, true);
  PERFORM set_config(
    'test.perm_archived_customer', v_archived_customer::text, true
  );
  PERFORM set_config('test.perm_job', v_job::text, true);
  PERFORM set_config('test.perm_other_job', v_other_job::text, true);
END;
$$;

-- Anonymous callers cannot execute the progress operation.
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'in_progress',
      'scheduled'
    )
  $$,
  '42501', NULL,
  'Anonymous callers cannot update job progress'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.perm_member'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.jobs),
  1::bigint,
  'Members can read jobs only in their workspace'
);

SELECT throws_ok(
  $$
    INSERT INTO public.jobs (
      organization_id, customer_id, title
    )
    VALUES (
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_customer')::uuid,
      'Unauthorized Job'
    )
  $$,
  '42501', NULL,
  'Members cannot create jobs'
);

WITH changed AS (
  UPDATE public.jobs
  SET title = 'Unauthorized Change'
  WHERE id = current_setting('test.perm_job')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Members cannot directly edit job details'
);

WITH changed AS (
  UPDATE public.jobs
  SET status = 'completed'
  WHERE id = current_setting('test.perm_job')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Members cannot bypass the progress operation with direct updates'
);

WITH removed AS (
  DELETE FROM public.jobs
  WHERE id = current_setting('test.perm_job')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM removed),
  0::bigint,
  'Members cannot delete jobs'
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'completed',
      'scheduled'
    )
  $$,
  '42501', 'Members can only start or complete work',
  'Members cannot skip directly from scheduled to completed'
);

SELECT lives_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'in_progress',
      'scheduled'
    )
  $$,
  'Members can start scheduled work'
);

SELECT is(
  (
    SELECT status FROM public.jobs
    WHERE id = current_setting('test.perm_job')::uuid
  ),
  'in_progress',
  'Starting work saves the new status'
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'in_progress',
      'scheduled'
    )
  $$,
  '40001', 'Job status changed. Reload before updating.',
  'A stale expected status is rejected'
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'canceled',
      'in_progress'
    )
  $$,
  '42501', 'Members can only start or complete work',
  'Members cannot cancel jobs'
);

SELECT lives_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'completed',
      'in_progress'
    )
  $$,
  'Members can complete work that is in progress'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = current_setting('test.perm_job')::uuid
      AND status = 'completed'
      AND completed_at IS NOT NULL
  ),
  'Completing work maintains its completion timestamp'
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'in_progress',
      'completed'
    )
  $$,
  '42501', 'Members can only start or complete work',
  'Members cannot reopen completed work'
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_other_org')::uuid,
      current_setting('test.perm_other_job')::uuid,
      'in_progress',
      'scheduled'
    )
  $$,
  '42501', 'Workspace access required',
  'Members cannot update progress in another workspace'
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_other_job')::uuid,
      'in_progress',
      'scheduled'
    )
  $$,
  'P0002', 'Job not found',
  'A foreign job ID cannot be used with the current workspace'
);

-- Members can edit live customer details.
WITH changed AS (
  UPDATE public.customers
  SET name = 'Updated Customer'
  WHERE id = current_setting('test.perm_customer')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'Members can edit live customer details'
);

SELECT throws_ok(
  $$
    UPDATE public.customers
    SET deleted_at = now()
    WHERE id = current_setting('test.perm_customer')::uuid
  $$,
  '42501',
  'Only owners and admins can archive, restore, or edit archived contacts',
  'Members cannot archive customers'
);

SELECT throws_ok(
  $$
    UPDATE public.customers
    SET deleted_at = NULL
    WHERE id = current_setting('test.perm_archived_customer')::uuid
  $$,
  '42501',
  'Only owners and admins can archive, restore, or edit archived contacts',
  'Members cannot restore archived customers'
);

SELECT throws_ok(
  $$
    UPDATE public.customers
    SET name = 'Unauthorized Archived Edit'
    WHERE id = current_setting('test.perm_archived_customer')::uuid
  $$,
  '42501',
  'Only owners and admins can archive, restore, or edit archived contacts',
  'Members cannot edit archived customers'
);

SELECT throws_ok(
  $$
    INSERT INTO public.customers (
      organization_id, name, deleted_at
    )
    VALUES (
      current_setting('test.perm_org')::uuid,
      'Already Archived',
      now()
    )
  $$,
  '42501', 'Only owners and admins can archive contacts',
  'Members cannot create already-archived customers'
);

WITH removed AS (
  DELETE FROM public.customers
  WHERE id = current_setting('test.perm_archived_customer')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM removed),
  0::bigint,
  'Members cannot permanently delete archived customers'
);

-- Admins retain management access.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.perm_admin'),
  true
);

WITH changed AS (
  UPDATE public.jobs
  SET title = 'Admin Updated Job'
  WHERE id = current_setting('test.perm_job')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'Admins can edit job details'
);

SELECT lives_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'canceled',
      'completed'
    )
  $$,
  'Admins can choose another supported job status'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = current_setting('test.perm_job')::uuid
      AND status = 'canceled'
      AND completed_at IS NULL
  ),
  'Leaving completed status clears the completion timestamp'
);

WITH changed AS (
  UPDATE public.customers
  SET deleted_at = NULL
  WHERE id = current_setting('test.perm_archived_customer')::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'Admins can restore archived customers'
);

-- Suspending a member immediately blocks the privileged RPC.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.perm_owner'),
  true
);

SELECT public.update_organization_member(
  current_setting('test.perm_org')::uuid,
  (
    SELECT id FROM public.organization_members
    WHERE organization_id = current_setting('test.perm_org')::uuid
      AND user_id = current_setting('test.perm_member')::uuid
  ),
  'member',
  'suspended'
);

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.perm_member'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.set_job_progress(
      current_setting('test.perm_org')::uuid,
      current_setting('test.perm_job')::uuid,
      'in_progress',
      'canceled'
    )
  $$,
  '42501', 'Workspace access required',
  'Suspended members cannot update job progress'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;