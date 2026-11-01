-- Membership writes remain unavailable through direct browser queries.
-- These functions authorize the caller and serialize changes per workspace.

CREATE FUNCTION public.update_organization_member(
  p_organization_id uuid,
  p_member_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member public.organization_members%ROWTYPE;
BEGIN
  IF p_role IS NULL
    OR p_role NOT IN ('owner', 'admin', 'member')
    OR p_status IS NULL
    OR p_status NOT IN ('active', 'suspended')
  THEN
    RAISE EXCEPTION 'Invalid membership role or status'
      USING ERRCODE = '22023';
  END IF;

  -- Acquire the workspace lock before checking authorization.
  -- Concurrent owner changes cannot both remove the final owner.
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

  SELECT member.*
  INTO v_member
  FROM public.organization_members AS member
  WHERE member.id = p_member_id
    AND member.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace member not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Legacy invited memberships must use invitation acceptance,
  -- rather than being activated through the management controls.
  IF v_member.status = 'invited' THEN
    RAISE EXCEPTION 'This member must accept an invitation first'
      USING ERRCODE = '23514';
  END IF;

  IF v_member.role = 'owner'
    AND v_member.status = 'active'
    AND (p_role <> 'owner' OR p_status <> 'active')
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members AS other
      WHERE other.organization_id = p_organization_id
        AND other.id <> p_member_id
        AND other.role = 'owner'
        AND other.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'The workspace must retain an active owner'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.organization_members AS member
  SET
    role = p_role,
    status = p_status,
    updated_at = clock_timestamp()
  WHERE member.id = p_member_id
    AND member.organization_id = p_organization_id;

  -- Existing activation triggers independently enforce
  -- subscription status and effective member limits.
END;
$$;

REVOKE ALL ON FUNCTION
  public.update_organization_member(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.update_organization_member(uuid, uuid, text, text)
TO authenticated;


CREATE FUNCTION public.remove_organization_member(
  p_organization_id uuid,
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member public.organization_members%ROWTYPE;
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

  SELECT member.*
  INTO v_member
  FROM public.organization_members AS member
  WHERE member.id = p_member_id
    AND member.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace member not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_member.role = 'owner'
    AND v_member.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members AS other
      WHERE other.organization_id = p_organization_id
        AND other.id <> p_member_id
        AND other.role = 'owner'
        AND other.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'The workspace must retain an active owner'
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.organization_members AS member
  WHERE member.id = p_member_id
    AND member.organization_id = p_organization_id;

  -- Removes workspace membership, not the person's login account.
END;
$$;

REVOKE ALL ON FUNCTION
  public.remove_organization_member(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.remove_organization_member(uuid, uuid)
TO authenticated;