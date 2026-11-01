-- =========================================================
-- Private invitation records
-- Access is through authenticated RPCs only.
-- =========================================================

CREATE TABLE private.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  email text NOT NULL,
  role text NOT NULL,

  status text NOT NULL DEFAULT 'pending',

  created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  accepted_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
    DEFAULT (now() + interval '7 days'),

  accepted_at timestamptz,
  revoked_at timestamptz,

  CONSTRAINT organization_invitations_email_check
    CHECK (
      email = lower(btrim(email))
      AND length(email) BETWEEN 3 AND 254
      AND email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
    ),

  CONSTRAINT organization_invitations_role_check
    CHECK (role IN ('admin', 'member')),

  CONSTRAINT organization_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked'))
);

ALTER TABLE private.organization_invitations
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.organization_invitations
FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX organization_invitations_pending_email_idx
ON private.organization_invitations (organization_id, email)
WHERE status = 'pending';

CREATE INDEX organization_invitations_email_idx
ON private.organization_invitations (email, expires_at)
WHERE status = 'pending';


-- =========================================================
-- Create an invitation
-- Reinviting replaces an earlier pending invitation.
-- No email is sent by this function.
-- =========================================================

CREATE FUNCTION public.create_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_id uuid;
BEGIN
  PERFORM 1
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_org_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL
    OR length(v_email) NOT BETWEEN 3 AND 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Enter a valid email address'
      USING ERRCODE = '22023';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Choose admin or member'
      USING ERRCODE = '22023';
  END IF;

  -- Do not use invitations to change an existing active
  -- member's role or reactivate a suspended membership.
  IF EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    JOIN auth.users AS account ON account.id = member.user_id
    WHERE member.organization_id = p_organization_id
      AND lower(btrim(account.email)) = v_email
      AND member.status IN ('active', 'suspended')
  ) THEN
    RAISE EXCEPTION 'This person already has a workspace membership'
      USING ERRCODE = '23514';
  END IF;

  UPDATE private.organization_invitations AS invitation
  SET
    status = 'revoked',
    revoked_at = clock_timestamp()
  WHERE invitation.organization_id = p_organization_id
    AND invitation.email = v_email
    AND invitation.status = 'pending';

  -- Bound outstanding invitations independently of active seats.
  IF (
    SELECT count(*)
    FROM private.organization_invitations AS invitation
    WHERE invitation.organization_id = p_organization_id
      AND invitation.status = 'pending'
      AND invitation.expires_at > clock_timestamp()
  ) >= 100 THEN
    RAISE EXCEPTION 'Too many pending workspace invitations'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO private.organization_invitations (
    organization_id, email, role, created_by, expires_at
  )
  VALUES (
    p_organization_id,
    v_email,
    p_role,
    auth.uid(),
    clock_timestamp() + interval '7 days'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- =========================================================
-- Revoke an invitation
-- Repeating revocation is harmless; accepted invitations stay accepted.
-- =========================================================

CREATE FUNCTION public.revoke_organization_invitation(
  p_organization_id uuid,
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_org_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM private.organization_invitations AS invitation
  WHERE invitation.id = p_invitation_id
    AND invitation.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace invitation not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE private.organization_invitations AS invitation
  SET
    status = 'revoked',
    revoked_at = clock_timestamp()
  WHERE invitation.id = p_invitation_id
    AND invitation.organization_id = p_organization_id
    AND invitation.status = 'pending';
END;
$$;


-- =========================================================
-- Owner invitation list
-- Expiration is derived; no scheduled expiration job is needed.
-- =========================================================

CREATE FUNCTION public.list_organization_invitations(
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_org_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    invitation.id,
    invitation.email,
    invitation.role,
    CASE
      WHEN invitation.status = 'pending'
        AND invitation.expires_at <= clock_timestamp()
      THEN 'expired'::text
      ELSE invitation.status
    END,
    invitation.created_at,
    invitation.expires_at
  FROM private.organization_invitations AS invitation
  WHERE invitation.organization_id = p_organization_id
  ORDER BY invitation.created_at DESC, invitation.id
  LIMIT 100;
END;
$$;


-- =========================================================
-- Recipient invitation list
-- Reads the verified email from auth.users, not user metadata
-- or an email supplied by the browser.
-- =========================================================

CREATE FUNCTION public.list_my_organization_invitations()
RETURNS TABLE (
  id uuid,
  organization_name text,
  organization_slug text,
  role text,
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    invitation.id,
    organization.name,
    organization.slug,
    invitation.role,
    invitation.expires_at
  FROM private.organization_invitations AS invitation
  JOIN public.organizations AS organization
    ON organization.id = invitation.organization_id
  JOIN auth.users AS account
    ON account.id = (SELECT auth.uid())
    AND account.email_confirmed_at IS NOT NULL
    AND lower(btrim(account.email)) = invitation.email
  WHERE invitation.status = 'pending'
    AND invitation.expires_at > clock_timestamp()
  ORDER BY invitation.created_at DESC, invitation.id
  LIMIT 100;
$$;


-- =========================================================
-- Accept an invitation
-- Membership creation and invitation acceptance are atomic.
-- Existing membership triggers enforce active-seat capacity.
-- =========================================================

CREATE FUNCTION public.accept_organization_invitation(
  p_invitation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_organization_id uuid;
  v_invitation private.organization_invitations%ROWTYPE;
  v_member public.organization_members%ROWTYPE;
BEGIN
  SELECT lower(btrim(account.email))
  INTO v_email
  FROM auth.users AS account
  WHERE account.id = v_user_id
    AND account.email_confirmed_at IS NOT NULL;

  IF NOT FOUND OR v_email IS NULL THEN
    RAISE EXCEPTION 'A verified email address is required'
      USING ERRCODE = '42501';
  END IF;

  -- Identify the workspace before taking locks in the same order
  -- as owner operations: workspace, then invitation, then member.
  SELECT invitation.organization_id
  INTO v_organization_id
  FROM private.organization_invitations AS invitation
  WHERE invitation.id = p_invitation_id
    AND invitation.email = v_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is unavailable'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.organizations
  WHERE id = v_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is unavailable'
      USING ERRCODE = '42501';
  END IF;

  SELECT invitation.*
  INTO v_invitation
  FROM private.organization_invitations AS invitation
  WHERE invitation.id = p_invitation_id
    AND invitation.organization_id = v_organization_id
    AND invitation.email = v_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is unavailable'
      USING ERRCODE = '42501';
  END IF;

  -- A repeated acceptance can return successfully only if the
  -- original recipient still has active workspace access.
  IF v_invitation.status = 'accepted'
    AND v_invitation.accepted_by = v_user_id
    AND EXISTS (
      SELECT 1
      FROM public.organization_members AS member
      WHERE member.organization_id = v_organization_id
        AND member.user_id = v_user_id
        AND member.status = 'active'
    )
  THEN
    RETURN v_organization_id;
  END IF;

  IF v_invitation.status <> 'pending'
    OR v_invitation.expires_at <= clock_timestamp()
  THEN
    RAISE EXCEPTION 'Invitation is expired or no longer available'
      USING ERRCODE = '23514';
  END IF;

  SELECT member.*
  INTO v_member
  FROM public.organization_members AS member
  WHERE member.organization_id = v_organization_id
    AND member.user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_member.status <> 'invited' THEN
      RAISE EXCEPTION 'This account already has a workspace membership'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.organization_members AS member
    SET
      role = v_invitation.role,
      status = 'active',
      updated_at = clock_timestamp()
    WHERE member.id = v_member.id
      AND member.organization_id = v_organization_id;
  ELSE
    INSERT INTO public.organization_members (
      organization_id, user_id, role, status
    )
    VALUES (
      v_organization_id,
      v_user_id,
      v_invitation.role,
      'active'
    );
  END IF;

  UPDATE private.organization_invitations AS invitation
  SET
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = clock_timestamp()
  WHERE invitation.id = p_invitation_id
    AND invitation.organization_id = v_organization_id;

  RETURN v_organization_id;
END;
$$;


-- =========================================================
-- Explicit RPC permissions
-- =========================================================

REVOKE ALL ON FUNCTION
  public.create_organization_invitation(uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.revoke_organization_invitation(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.list_organization_invitations(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.list_my_organization_invitations()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.accept_organization_invitation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.create_organization_invitation(uuid, text, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.revoke_organization_invitation(uuid, uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.list_organization_invitations(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.list_my_organization_invitations()
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.accept_organization_invitation(uuid)
TO authenticated;