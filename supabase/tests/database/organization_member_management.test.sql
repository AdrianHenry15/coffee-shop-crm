BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT no_plan();

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

-- All fixtures and changes roll back.
DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_other_org uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at
  )
  SELECT
    id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    id::text || '@test.local',
    '',
    now(),
    now(),
    now()
  FROM unnest(
    ARRAY[v_owner, v_admin, v_member, v_outsider]
  ) AS fixture(id);

  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (v_org, 'Team Test', 'team-' || v_org::text),
    (
      v_other_org,
      'Other Team Test',
      'team-' || v_other_org::text
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

  PERFORM set_config('test.team_org', v_org::text, true);
  PERFORM set_config('test.team_owner', v_owner::text, true);
  PERFORM set_config('test.team_admin', v_admin::text, true);
  PERFORM set_config('test.team_member', v_member::text, true);
  PERFORM set_config('test.team_outsider', v_outsider::text, true);

  PERFORM set_config(
    'test.team_owner_membership',
    (
      SELECT id::text FROM public.organization_members
      WHERE organization_id = v_org AND user_id = v_owner
    ),
    true
  );

  PERFORM set_config(
    'test.team_member_membership',
    (
      SELECT id::text FROM public.organization_members
      WHERE organization_id = v_org AND user_id = v_member
    ),
    true
  );

  PERFORM set_config(
    'test.team_foreign_membership',
    (
      SELECT id::text FROM public.organization_members
      WHERE organization_id = v_other_org
        AND user_id = v_outsider
    ),
    true
  );
END;
$$;

-- Anonymous callers cannot execute either operation.
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'admin', 'active'
    )
  $$,
  '42501', NULL,
  'Anonymous callers cannot update memberships'
);

SELECT throws_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid
    )
  $$,
  '42501', NULL,
  'Anonymous callers cannot remove memberships'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- A regular member cannot promote themselves.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_member'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'owner', 'active'
    )
  $$,
  '42501', 'Workspace management access required',
  'Members cannot promote themselves'
);

-- Organization admins cannot manage the team.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_admin'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid
    )
  $$,
  '42501', 'Workspace management access required',
  'Admins cannot remove members'
);

-- Ownership of another organization grants no access.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_outsider'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'admin', 'active'
    )
  $$,
  '42501', 'Workspace management access required',
  'Another workspace owner cannot manage this team'
);

-- Perform the remaining operations as the workspace owner.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_owner'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_foreign_membership')::uuid
    )
  $$,
  'P0002', 'Workspace member not found',
  'A foreign membership ID cannot be removed'
);

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'platform_admin', 'active'
    )
  $$,
  '22023', 'Invalid membership role or status',
  'Platform roles cannot be assigned as workspace roles'
);

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_owner_membership')::uuid,
      'admin', 'active'
    )
  $$,
  '23514', 'The workspace must retain an active owner',
  'The last active owner cannot be demoted'
);

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_owner_membership')::uuid,
      'owner', 'suspended'
    )
  $$,
  '23514', 'The workspace must retain an active owner',
  'The last active owner cannot be suspended'
);

SELECT throws_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_owner_membership')::uuid
    )
  $$,
  '23514', 'The workspace must retain an active owner',
  'The last active owner cannot be removed'
);

SELECT lives_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'admin', 'active'
    )
  $$,
  'An owner can change a member role'
);

SELECT is(
  (
    SELECT role FROM public.organization_members
    WHERE id = current_setting('test.team_member_membership')::uuid
  ),
  'admin',
  'The role change was saved'
);

SELECT lives_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'member', 'suspended'
    )
  $$,
  'An owner can suspend a member'
);

-- Suspension must actually remove workspace authorization.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_member'),
  true
);

SELECT ok(
  NOT private.is_org_member(current_setting('test.team_org')::uuid),
  'Suspended members no longer have workspace access'
);

-- Fill the plan by lowering its limit below current active usage.
RESET ROLE;

UPDATE public.organization_subscriptions
SET plan_id = 'free'
WHERE organization_id = current_setting('test.team_org')::uuid;

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_owner'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'member', 'active'
    )
  $$,
  'P0001', 'Subscription limit reached for organization_members',
  'Reactivation cannot bypass the active-seat limit'
);

-- Restore capacity and verify reactivation.
RESET ROLE;

UPDATE public.organization_subscriptions
SET plan_id = 'pro'
WHERE organization_id = current_setting('test.team_org')::uuid;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'member', 'active'
    )
  $$,
  'Reactivation succeeds when capacity is available'
);

-- Ownership can be handed over without leaving the workspace ownerless.
SELECT lives_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid,
      'owner', 'active'
    )
  $$,
  'An owner can appoint another owner'
);

SELECT lives_ok(
  $$
    SELECT public.update_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_owner_membership')::uuid,
      'member', 'active'
    )
  $$,
  'An owner can step down after appointing another owner'
);

SELECT throws_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_member_membership')::uuid
    )
  $$,
  '42501', 'Workspace management access required',
  'A former owner immediately loses team-management authority'
);

-- The new owner can remove the former owner's membership.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.team_member'),
  true
);

SELECT lives_ok(
  $$
    SELECT public.remove_organization_member(
      current_setting('test.team_org')::uuid,
      current_setting('test.team_owner_membership')::uuid
    )
  $$,
  'The new owner can remove another membership'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE id = current_setting('test.team_owner_membership')::uuid
  ),
  'The removed membership is absent'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = current_setting('test.team_owner')::uuid
  ),
  'Removing a membership preserves the login account'
);

SELECT * FROM finish();
ROLLBACK;