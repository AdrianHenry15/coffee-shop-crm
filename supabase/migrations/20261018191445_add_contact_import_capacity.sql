CREATE OR REPLACE FUNCTION public.get_contact_import_capacity(
  p_organization_id uuid,
  p_resource text
)
RETURNS TABLE (
  resource_limit integer,
  used_count bigint,
  remaining_count bigint,
  is_unlimited boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_subscription_status text;
  v_limit integer;
  v_used bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_resource IS NULL
    OR p_resource NOT IN ('leads', 'customers')
  THEN
    RAISE EXCEPTION 'Unsupported contact resource'
      USING ERRCODE = '22023';
  END IF;

  -- Admin exemptions affect capacity, not workspace access.
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = v_user_id
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Organization access denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.status
  INTO v_subscription_status
  FROM public.organization_subscriptions AS s
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization subscription not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_subscription_status IS NULL
    OR v_subscription_status NOT IN ('active', 'trialing')
  THEN
    RAISE EXCEPTION 'Organization subscription is not active'
      USING ERRCODE = 'P0001';
  END IF;

  -- NULL represents unlimited capacity.
  IF private.is_platform_admin() THEN
    v_limit := NULL;
  ELSE
    v_limit := private.get_effective_subscription_limit(
      p_organization_id,
      p_resource
    );
  END IF;

  IF p_resource = 'leads' THEN
    SELECT count(*)
    INTO v_used
    FROM public.leads AS l
    WHERE l.organization_id = p_organization_id;
  ELSE
    SELECT count(*)
    INTO v_used
    FROM public.customers AS c
    WHERE c.organization_id = p_organization_id;
  END IF;

  RETURN QUERY
  SELECT
    v_limit,
    v_used,
    CASE
      WHEN v_limit IS NULL THEN NULL::bigint
      ELSE greatest(0::bigint, v_limit::bigint - v_used)
    END,
    v_limit IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_import_capacity(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_contact_import_capacity(uuid, text)
TO authenticated;