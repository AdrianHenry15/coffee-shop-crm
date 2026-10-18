-- =========================================================
-- Private account details
-- Personal contact information is separate from shared profiles.
-- =========================================================

CREATE TABLE public.account_details (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  phone text,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT account_phone_length
    CHECK (phone IS NULL OR length(phone) <= 50)
);

ALTER TABLE public.account_details ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_details
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.account_details
TO authenticated;

CREATE POLICY "Users can read own account details"
ON public.account_details
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
);

-- Create an empty private record for existing accounts.
INSERT INTO public.account_details (user_id)
SELECT id
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =========================================================
-- Capture signup information.
-- Keep the existing on_auth_user_created trigger.
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name
  )
  VALUES (
    NEW.id,
    NULLIF(
      left(btrim(NEW.raw_user_meta_data ->> 'first_name'), 100),
      ''
    ),
    NULLIF(
      left(btrim(NEW.raw_user_meta_data ->> 'last_name'), 100),
      ''
    )
  );

  INSERT INTO public.account_details (
    user_id,
    phone
  )
  VALUES (
    NEW.id,
    NULLIF(
      left(btrim(NEW.raw_user_meta_data ->> 'contact_phone'), 50),
      ''
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Update personal details in one transaction.
-- Login email remains managed by Supabase Auth.
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_account_details(
  p_first_name text,
  p_last_name text,
  p_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_first_name text := btrim(p_first_name);
  v_last_name text := btrim(p_last_name);
  v_phone text := NULLIF(btrim(p_phone), '');
  v_phone_digits text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF v_first_name IS NULL
    OR length(v_first_name) NOT BETWEEN 1 AND 100
    OR v_last_name IS NULL
    OR length(v_last_name) NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'First and last names must contain 1–100 characters'
      USING ERRCODE = '22023';
  END IF;

  IF v_phone IS NOT NULL THEN
    v_phone_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');

    IF length(v_phone) > 50
      OR length(v_phone_digits) NOT BETWEEN 7 AND 15
    THEN
      RAISE EXCEPTION 'Enter a phone number containing 7–15 digits'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name
  )
  VALUES (
    v_user_id,
    v_first_name,
    v_last_name
  )
  ON CONFLICT (id)
  DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  INSERT INTO public.account_details (
    user_id,
    phone
  )
  VALUES (
    v_user_id,
    v_phone
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    phone = EXCLUDED.phone,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.update_account_details(text, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_account_details(text, text, text)
TO authenticated;

-- =========================================================
-- Create the initial workspace with its business information.
-- Workspace creation and business details commit together.
-- =========================================================

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
AS $$
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

  -- A repeated initial-onboarding submission reuses the workspace.
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

  -- Reuse the existing organization and owner-membership creation.
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
$$;

REVOKE ALL ON FUNCTION public.onboard_organization(
  text, text, text, text, text, text, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.onboard_organization(
  text, text, text, text, text, text, text
)
TO authenticated;