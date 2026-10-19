CREATE OR REPLACE FUNCTION public.update_catalog_template(
  p_organization_id uuid,
  p_template_id uuid,
  p_expected_version_id uuid,
  p_name text,
  p_description text,
  p_fields jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_template public.catalog_templates%ROWTYPE;
  v_current_version public.catalog_template_versions%ROWTYPE;
  v_next_version_number integer;
  v_new_version_id uuid;
BEGIN
  IF NOT private.can_manage_catalog(p_organization_id) THEN
    RAISE EXCEPTION
      'Only workspace owners and admins can manage templates'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize changes to this template.
  SELECT *
  INTO v_template
  FROM public.catalog_templates
  WHERE id = p_template_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog template not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_template.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived templates cannot be edited'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_current_version
  FROM public.catalog_template_versions
  WHERE template_id = p_template_id
    AND organization_id = p_organization_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active template version not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Prevent an older editor tab from replacing newer changes.
  IF v_current_version.id IS DISTINCT FROM p_expected_version_id THEN
    RAISE EXCEPTION
      'This template changed. Reload the page before saving.'
      USING ERRCODE = '40001';
  END IF;

  IF p_name IS NULL
    OR length(btrim(p_name)) NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Invalid template name'
      USING ERRCODE = '22023';
  END IF;

  IF length(coalesce(p_description, '')) > 2000 THEN
    RAISE EXCEPTION 'Template description is too long'
      USING ERRCODE = '22023';
  END IF;

  IF p_fields IS NULL
    OR jsonb_typeof(p_fields) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Template fields must be an array'
      USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(version_number), 0) + 1
  INTO v_next_version_number
  FROM public.catalog_template_versions
  WHERE template_id = p_template_id
    AND organization_id = p_organization_id;

  -- Existing constraints and triggers validate the field definitions.
  INSERT INTO public.catalog_template_versions (
    organization_id,
    template_id,
    version_number,
    status,
    fields
  )
  VALUES (
    p_organization_id,
    p_template_id,
    v_next_version_number,
    'draft',
    p_fields
  )
  RETURNING id INTO v_new_version_id;

  UPDATE public.catalog_template_versions
  SET status = 'retired'
  WHERE id = v_current_version.id
    AND organization_id = p_organization_id;

  UPDATE public.catalog_template_versions
  SET status = 'active'
  WHERE id = v_new_version_id
    AND organization_id = p_organization_id;

  UPDATE public.catalog_templates
  SET
    name = btrim(p_name),
    description = nullif(btrim(p_description), '')
  WHERE id = p_template_id
    AND organization_id = p_organization_id;

  RETURN p_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_catalog_template(
  uuid, uuid, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_catalog_template(
  uuid, uuid, uuid, text, text, jsonb
) TO authenticated;