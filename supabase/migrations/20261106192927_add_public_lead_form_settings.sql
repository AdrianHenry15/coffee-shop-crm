CREATE TABLE public.organization_lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT 'Contact us',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_lead_forms_title_check
    CHECK (length(btrim(title)) BETWEEN 1 AND 100)
);

ALTER TABLE public.organization_lead_forms
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organization_lead_forms
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.organization_lead_forms
TO authenticated;

CREATE POLICY lead_form_managers_select
ON public.organization_lead_forms
FOR SELECT
TO authenticated
USING (
  (SELECT private.can_manage_business_records(organization_id))
);


-- Workspace owners/admins configure forms through this RPC.
CREATE FUNCTION public.configure_organization_lead_form(
  p_organization_id uuid,
  p_enabled boolean,
  p_title text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_form_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_current_legal_acceptance() THEN
    RAISE EXCEPTION 'Current legal acceptance is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_enabled IS NULL
    OR p_title IS NULL
    OR length(btrim(p_title)) NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Enter a form title containing 1–100 characters'
      USING ERRCODE = '22023';
  END IF;

  -- Coordinate with membership changes and later submissions.
  PERFORM 1
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_manage_business_records(p_organization_id) THEN
    RAISE EXCEPTION 'Workspace management access required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.organization_lead_forms (
    organization_id,
    enabled,
    title
  )
  VALUES (
    p_organization_id,
    p_enabled,
    btrim(p_title)
  )
  ON CONFLICT (organization_id)
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    title = EXCLUDED.title,
    updated_at = clock_timestamp()
  RETURNING id INTO v_form_id;

  RETURN v_form_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.configure_organization_lead_form(uuid, boolean, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.configure_organization_lead_form(uuid, boolean, text)
TO authenticated;


-- Only the application server can retrieve public display details.
-- Disabled forms return no rows.
CREATE FUNCTION public.get_public_lead_form(
  p_form_id uuid
)
RETURNS TABLE (
  form_id uuid,
  workspace_name text,
  title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    form.id,
    organization.name,
    form.title
  FROM public.organization_lead_forms AS form
  JOIN public.organizations AS organization
    ON organization.id = form.organization_id
  WHERE form.id = p_form_id
    AND form.enabled = true;
$$;

REVOKE ALL ON FUNCTION public.get_public_lead_form(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_lead_form(uuid)
TO service_role;