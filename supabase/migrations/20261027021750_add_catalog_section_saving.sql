CREATE OR REPLACE FUNCTION public.save_catalog_item_sections(
  p_organization_id uuid,
  p_item_id uuid,
  p_expected_updated_at timestamptz,
  p_sections jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item public.catalog_items%ROWTYPE;
BEGIN
  IF NOT private.can_manage_catalog(p_organization_id) THEN
    RAISE EXCEPTION 'Catalog management permission required'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_item
  FROM public.catalog_items
  WHERE id = p_item_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_item.status <> 'draft' THEN
    RAISE EXCEPTION 'Move this item to draft before editing content'
      USING ERRCODE = '23514';
  END IF;

  IF v_item.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'This item changed. Reload before saving.'
      USING ERRCODE = '40001';
  END IF;

  IF p_sections IS NULL
    OR jsonb_typeof(p_sections) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Sections must be an array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_sections) > 30
    OR octet_length(p_sections::text) > 524288
  THEN
    RAISE EXCEPTION 'Too much section content'
      USING ERRCODE = '22023';
  END IF;

  -- Advance the item's revision so stale editor tabs cannot
  -- replace content saved by another request.
  UPDATE public.catalog_items
  SET updated_at = now()
  WHERE id = p_item_id
    AND organization_id = p_organization_id;

  -- Replace the ordered collection atomically.
  -- Any invalid section rolls back the entire operation.
  DELETE FROM public.catalog_item_sections
  WHERE item_id = p_item_id
    AND organization_id = p_organization_id;

  INSERT INTO public.catalog_item_sections (
    id,
    organization_id,
    item_id,
    kind,
    title,
    position,
    content
  )
  SELECT
    (entry.section ->> 'id')::uuid,
    p_organization_id,
    p_item_id,
    entry.section ->> 'kind',
    entry.section ->> 'title',
    (entry.ordinality - 1)::integer,
    entry.section -> 'content'
  FROM jsonb_array_elements(p_sections)
    WITH ORDINALITY AS entry(section, ordinality);
END;
$$;

REVOKE ALL ON FUNCTION public.save_catalog_item_sections(
  uuid, uuid, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_catalog_item_sections(
  uuid, uuid, timestamptz, jsonb
) TO authenticated;