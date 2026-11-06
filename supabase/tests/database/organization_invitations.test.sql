BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT no_plan();

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

-- Fixtures are isolated and rolled back.
DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_other_org uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_recipient uuid := gen_random_uuid();
  v_unverified uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
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
    CASE
      WHEN fixture.id = v_unverified THEN NULL
      ELSE now()
    END,
    now(),
    now()
  FROM unnest(
    ARRAY[v_owner, v_recipient, v_unverified, v_outsider]
  ) AS fixture(id);

  -- These verified test accounts have accepted the current documents.
  INSERT INTO private.account_legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    source
  )
  SELECT
    fixture.id,
    '2026-11-03',
    '2026-11-03',
    'authenticated_acceptance'
  FROM unnest(
    ARRAY[v_owner, v_recipient, v_outsider]
  ) AS fixture(id);

  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (v_org, 'Invitation Test', 'invite-' || v_org::text),
    (
      v_other_org,
      'Other Invitation Test',
      'invite-' || v_other_org::text
    );

  UPDATE public.organization_subscriptions
  SET plan_id = 'free', status = 'active'
  WHERE organization_id IN (v_org, v_other_org);

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status
  )
  VALUES
    (v_org, v_owner, 'owner', 'active'),
    (v_other_org, v_outsider, 'owner', 'active');

  PERFORM set_config('test.inv_org', v_org::text, true);
  PERFORM set_config('test.inv_owner', v_owner::text, true);
  PERFORM set_config('test.inv_recipient', v_recipient::text, true);
  PERFORM set_config('test.inv_unverified', v_unverified::text, true);
  PERFORM set_config('test.inv_outsider', v_outsider::text, true);
END;
$$;

-- Anonymous callers cannot execute acceptance.
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(gen_random_uuid())
  $$,
  '42501', NULL,
  'Anonymous callers cannot accept invitations'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_owner'),
  true
);

SELECT throws_ok(
  $$ SELECT * FROM private.organization_invitations $$,
  '42501', NULL,
  'Browser roles cannot read the private invitation table'
);

SELECT throws_ok(
  $$
    SELECT public.create_organization_invitation(
      current_setting('test.inv_org')::uuid,
      'person@test.local',
      'owner'
    )
  $$,
  '22023', 'Choose admin or member',
  'Invitations cannot directly grant ownership'
);

-- Inviting an existing verified account.
SELECT set_config(
  'test.inv_first',
  public.create_organization_invitation(
    current_setting('test.inv_org')::uuid,
    '  ' || upper(current_setting('test.inv_recipient')) ||
      '@TEST.LOCAL  ',
    'admin'
  )::text,
  true
);

SELECT is(
  (
    SELECT email
    FROM public.list_organization_invitations(
      current_setting('test.inv_org')::uuid
    )
    WHERE id = current_setting('test.inv_first')::uuid
  ),
  current_setting('test.inv_recipient') || '@test.local',
  'Invitation email addresses are normalized'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.organization_members
    WHERE organization_id = current_setting('test.inv_org')::uuid
      AND status = 'active'
  ),
  1::bigint,
  'Creating an invitation does not consume an active seat'
);

-- Accounts do not have to exist before an invitation is created.
SELECT set_config(
  'test.inv_new_account',
  public.create_organization_invitation(
    current_setting('test.inv_org')::uuid,
    gen_random_uuid()::text || '@test.local',
    'member'
  )::text,
  true
);

SELECT ok(
  current_setting('test.inv_new_account')::uuid IS NOT NULL,
  'An owner can invite an email without an existing account'
);

SELECT set_config(
  'test.inv_unverified_id',
  public.create_organization_invitation(
    current_setting('test.inv_org')::uuid,
    current_setting('test.inv_unverified') || '@test.local',
    'member'
  )::text,
  true
);

-- An unverified email cannot discover or accept invitations.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_unverified'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.list_my_organization_invitations()),
  0::bigint,
  'Unverified accounts cannot list recipient invitations'
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_unverified_id')::uuid
    )
  $$,
  '42501', 'A verified email address is required',
  'Unverified accounts cannot accept invitations'
);

-- Ownership of a different workspace grants no invitation access.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_outsider'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.create_organization_invitation(
      current_setting('test.inv_org')::uuid,
      'person@test.local',
      'member'
    )
  $$,
  '42501', 'Workspace management access required',
  'Another workspace owner cannot create invitations here'
);

SELECT throws_ok(
  $$
    SELECT * FROM public.list_organization_invitations(
      current_setting('test.inv_org')::uuid
    )
  $$,
  '42501', 'Workspace management access required',
  'Another workspace owner cannot list invitations here'
);

SELECT throws_ok(
  $$
    SELECT public.revoke_organization_invitation(
      current_setting('test.inv_org')::uuid,
      current_setting('test.inv_first')::uuid
    )
  $$,
  '42501', 'Workspace management access required',
  'Another workspace owner cannot revoke invitations here'
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_first')::uuid
    )
  $$,
  '42501', 'Invitation is unavailable',
  'A different email cannot accept the invitation'
);

-- The correct recipient can discover their invitation.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_recipient'),
  true
);

SELECT is(
  (SELECT count(*) FROM public.list_my_organization_invitations()),
  1::bigint,
  'A verified recipient sees their pending invitation'
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_first')::uuid
    )
  $$,
  'P0001', 'Subscription limit reached for organization_members',
  'Acceptance cannot exceed the active-seat limit'
);

RESET ROLE;

SELECT is(
  (
    SELECT status
    FROM private.organization_invitations
    WHERE id = current_setting('test.inv_first')::uuid
  ),
  'pending',
  'Failed acceptance leaves the invitation pending'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = current_setting('test.inv_org')::uuid
      AND user_id = current_setting('test.inv_recipient')::uuid
  ),
  'Failed acceptance leaves no partial membership'
);

UPDATE public.organization_subscriptions
SET plan_id = 'pro'
WHERE organization_id = current_setting('test.inv_org')::uuid;

SET LOCAL ROLE authenticated;

SELECT is(
  public.accept_organization_invitation(
    current_setting('test.inv_first')::uuid
  ),
  current_setting('test.inv_org')::uuid,
  'Acceptance succeeds when capacity is available'
);

SELECT is(
  (
    SELECT role
    FROM public.organization_members
    WHERE organization_id = current_setting('test.inv_org')::uuid
      AND user_id = current_setting('test.inv_recipient')::uuid
      AND status = 'active'
  ),
  'admin',
  'Acceptance creates the intended active workspace role'
);

SELECT is(
  public.accept_organization_invitation(
    current_setting('test.inv_first')::uuid
  ),
  current_setting('test.inv_org')::uuid,
  'Repeated acceptance succeeds without another membership'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.organization_members
    WHERE organization_id = current_setting('test.inv_org')::uuid
      AND user_id = current_setting('test.inv_recipient')::uuid
  ),
  1::bigint,
  'Repeated acceptance does not duplicate membership'
);

SELECT is(
  (SELECT count(*) FROM public.list_my_organization_invitations()),
  0::bigint,
  'Accepted invitations disappear from the pending recipient list'
);

SELECT throws_ok(
  $$
    SELECT public.create_organization_invitation(
      current_setting('test.inv_org')::uuid,
      'another@test.local',
      'member'
    )
  $$,
  '42501', 'Workspace management access required',
  'An invited admin does not gain owner invitation privileges'
);

-- Replaying an accepted invitation cannot bypass suspension.
RESET ROLE;

UPDATE public.organization_members
SET status = 'suspended'
WHERE organization_id = current_setting('test.inv_org')::uuid
  AND user_id = current_setting('test.inv_recipient')::uuid;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_first')::uuid
    )
  $$,
  '23514', 'Invitation is expired or no longer available',
  'Replaying an accepted invitation cannot reactivate suspension'
);

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_owner'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.create_organization_invitation(
      current_setting('test.inv_org')::uuid,
      current_setting('test.inv_recipient') || '@test.local',
      'member'
    )
  $$,
  '23514', 'This person already has a workspace membership',
  'A new invitation cannot bypass a suspended membership'
);

-- Reinviting replaces the old invitation.
SELECT set_config(
  'test.inv_old',
  public.create_organization_invitation(
    current_setting('test.inv_org')::uuid,
    current_setting('test.inv_outsider') || '@test.local',
    'admin'
  )::text,
  true
);

SELECT set_config(
  'test.inv_replacement',
  public.create_organization_invitation(
    current_setting('test.inv_org')::uuid,
    current_setting('test.inv_outsider') || '@test.local',
    'member'
  )::text,
  true
);

SELECT is(
  (
    SELECT status
    FROM public.list_organization_invitations(
      current_setting('test.inv_org')::uuid
    )
    WHERE id = current_setting('test.inv_old')::uuid
  ),
  'revoked',
  'Reinviting revokes the previous invitation'
);

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_outsider'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_old')::uuid
    )
  $$,
  '23514', 'Invitation is expired or no longer available',
  'A replaced invitation cannot be accepted'
);

-- Expired invitations are hidden and cannot be accepted.
RESET ROLE;

UPDATE private.organization_invitations
SET expires_at = clock_timestamp() - interval '1 minute'
WHERE id = current_setting('test.inv_replacement')::uuid;

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.list_my_organization_invitations()),
  0::bigint,
  'Expired invitations are hidden from the pending recipient list'
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_replacement')::uuid
    )
  $$,
  '23514', 'Invitation is expired or no longer available',
  'Expired invitations cannot be accepted'
);

-- Explicit revocation also prevents acceptance.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_owner'),
  true
);

SELECT set_config(
  'test.inv_revocable',
  public.create_organization_invitation(
    current_setting('test.inv_org')::uuid,
    current_setting('test.inv_outsider') || '@test.local',
    'member'
  )::text,
  true
);

SELECT lives_ok(
  $$
    SELECT public.revoke_organization_invitation(
      current_setting('test.inv_org')::uuid,
      current_setting('test.inv_revocable')::uuid
    )
  $$,
  'An owner can revoke a pending invitation'
);

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.inv_outsider'),
  true
);

SELECT throws_ok(
  $$
    SELECT public.accept_organization_invitation(
      current_setting('test.inv_revocable')::uuid
    )
  $$,
  '23514', 'Invitation is expired or no longer available',
  'Revoked invitations cannot be accepted'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;