CREATE OR REPLACE FUNCTION public.create_catalog_template(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_kind text,
  p_fields jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_template_id uuid;
  v_version_id uuid;
BEGIN
  IF NOT private.can_manage_catalog(p_organization_id) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can manage the catalog'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.catalog_templates (
    organization_id,
    name,
    description,
    kind
  )
  VALUES (
    p_organization_id,
    btrim(p_name),
    NULLIF(btrim(p_description), ''),
    p_kind
  )
  RETURNING id INTO v_template_id;

  INSERT INTO public.catalog_template_versions (
    organization_id,
    template_id,
    version_number,
    fields
  )
  VALUES (
    p_organization_id,
    v_template_id,
    1,
    p_fields
  )
  RETURNING id INTO v_version_id;

  UPDATE public.catalog_template_versions
  SET status = 'active'
  WHERE id = v_version_id;

  RETURN v_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_catalog_template(
  uuid, text, text, text, jsonb
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_catalog_template(
  uuid, text, text, text, jsonb
)
TO authenticated;