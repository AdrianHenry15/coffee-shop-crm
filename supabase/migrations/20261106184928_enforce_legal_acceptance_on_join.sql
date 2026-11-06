CREATE OR REPLACE FUNCTION public.accept_organization_invitation(
  p_invitation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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

  IF NOT public.has_current_legal_acceptance() THEN
    RAISE EXCEPTION 'Current legal acceptance is required'
      USING ERRCODE = '42501';
  END IF;

  -- Lock order: workspace, invitation, member.
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
      organization_id,
      user_id,
      role,
      status
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
$function$;


CREATE OR REPLACE FUNCTION public.onboard_organization(
  p_name text,
  p_slug text,
  p_email text,
  p_phone text,
  p_website text,
  p_address text,
  p_timezone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_org_id uuid;
  v_email text := NULLIF(btrim(p_email), '');
  v_phone text := NULLIF(btrim(p_phone), '');
  v_website text := NULLIF(btrim(p_website), '');
  v_address text := NULLIF(btrim(p_address), '');
  v_timezone text := btrim(p_timezone);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize initial onboarding requests for this account.
  SELECT u.email_confirmed_at
  INTO v_confirmed_at
  FROM auth.users AS u
  WHERE u.id = v_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirm your email before creating a workspace'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_current_legal_acceptance() THEN
    RAISE EXCEPTION 'Current legal acceptance is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL
    OR length(btrim(p_name)) NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Business name must contain 1–100 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_slug IS NULL
    OR length(p_slug) NOT BETWEEN 1 AND 60
    OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  THEN
    RAISE EXCEPTION 'Invalid workspace URL name'
      USING ERRCODE = '22023';
  END IF;

  IF v_email IS NULL
    OR length(v_email) > 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Enter a valid business email'
      USING ERRCODE = '22023';
  END IF;

  IF v_phone IS NOT NULL THEN
    IF length(v_phone) > 50
      OR length(regexp_replace(v_phone, '[^0-9]', '', 'g'))
        NOT BETWEEN 7 AND 15
    THEN
      RAISE EXCEPTION 'Enter a business phone number containing 7–15 digits'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_website IS NOT NULL THEN
    IF length(v_website) > 2048
      OR v_website !~* '^https?://[^[:space:]]+$'
    THEN
      RAISE EXCEPTION 'Business website must start with http:// or https://'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_address IS NOT NULL AND length(v_address) > 1000 THEN
    RAISE EXCEPTION 'Business address must be 1,000 characters or fewer'
      USING ERRCODE = '22023';
  END IF;

  IF v_timezone IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names AS t
    WHERE t.name = v_timezone
  ) THEN
    RAISE EXCEPTION 'Select a valid timezone'
      USING ERRCODE = '22023';
  END IF;

  -- Repeated initial onboarding reuses the existing workspace.
  SELECT m.organization_id
  INTO v_org_id
  FROM public.organization_members AS m
  WHERE m.user_id = v_user_id
    AND m.status = 'active'
  ORDER BY m.created_at, m.id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_org_id;
  END IF;

  v_org_id := public.create_organization(
    btrim(p_name),
    p_slug
  );

  UPDATE public.organizations
  SET
    email = v_email,
    phone = v_phone,
    website = v_website,
    address = v_address,
    timezone = v_timezone,
    updated_at = now()
  WHERE id = v_org_id;

  RETURN v_org_id;
END;
$function$;