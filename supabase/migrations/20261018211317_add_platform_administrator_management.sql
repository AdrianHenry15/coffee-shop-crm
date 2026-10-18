-- =========================================================
-- Only platform owners can manage administrator access.
-- =========================================================

CREATE OR REPLACE FUNCTION private.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS a
    WHERE a.user_id = (SELECT auth.uid())
      AND a.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION private.is_platform_owner()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.is_platform_owner()
TO authenticated;

-- =========================================================
-- List existing platform administrators.
-- Email addresses are exposed only to platform owners.
-- =========================================================

CREATE OR REPLACE FUNCTION public.list_platform_administrators()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_platform_owner() THEN
    RAISE EXCEPTION 'Only platform owners can manage administrators'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.user_id,
    u.email::text,
    a.role,
    a.created_at
  FROM public.platform_admins AS a
  JOIN auth.users AS u
    ON u.id = a.user_id
  ORDER BY
    CASE WHEN a.role = 'owner' THEN 0 ELSE 1 END,
    a.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.list_platform_administrators()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_platform_administrators()
TO authenticated;

-- =========================================================
-- Grant delegated administrator access to an existing user.
-- This function cannot grant or overwrite the owner role.
-- =========================================================

CREATE OR REPLACE FUNCTION public.grant_platform_administrator(
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_matching_users uuid[];
  v_target_id uuid;
  v_saved_id uuid;
BEGIN
  IF NOT private.is_platform_owner() THEN
    RAISE EXCEPTION 'Only platform owners can manage administrators'
      USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL
    OR v_email = ''
    OR length(v_email) > 254
  THEN
    RAISE EXCEPTION 'Enter a valid account email'
      USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(u.id)
  INTO v_matching_users
  FROM auth.users AS u
  WHERE lower(u.email) = v_email;

  IF coalesce(cardinality(v_matching_users), 0) <> 1 THEN
    RAISE EXCEPTION
      'Unable to identify one registered account with that email'
      USING ERRCODE = '22023';
  END IF;

  v_target_id := v_matching_users[1];

  INSERT INTO public.platform_admins AS a (
    user_id,
    role
  )
  VALUES (
    v_target_id,
    'admin'
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET role = EXCLUDED.role
    WHERE a.role <> 'owner'
  RETURNING a.user_id INTO v_saved_id;

  IF v_saved_id IS NULL THEN
    RAISE EXCEPTION 'The platform owner role cannot be changed here'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_platform_administrator(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_platform_administrator(text)
TO authenticated;

-- =========================================================
-- Remove delegated access.
-- Owner records cannot be removed through this function.
-- =========================================================

CREATE OR REPLACE FUNCTION public.revoke_platform_administrator(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT private.is_platform_owner() THEN
    RAISE EXCEPTION 'Only platform owners can manage administrators'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'An account ID is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT a.role
  INTO v_role
  FROM public.platform_admins AS a
  WHERE a.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'The platform owner cannot be removed here'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.platform_admins
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_platform_administrator(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.revoke_platform_administrator(uuid)
TO authenticated;