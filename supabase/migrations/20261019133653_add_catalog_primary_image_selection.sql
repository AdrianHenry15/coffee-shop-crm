CREATE OR REPLACE FUNCTION public.set_catalog_primary_image(
  p_organization_id uuid,
  p_item_id uuid,
  p_image_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.can_manage_catalog(p_organization_id) THEN
    RAISE EXCEPTION 'Catalog management permission required'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize gallery changes for this item.
  PERFORM 1
  FROM public.catalog_items
  WHERE id = p_item_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item not found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.catalog_item_images
  WHERE id = p_image_id
    AND item_id = p_item_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog image not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Position zero is the primary image.
  -- Preserve the relative order of the remaining images.
  WITH ranked AS (
    SELECT
      id,
      (
        row_number() OVER (
          ORDER BY
            CASE WHEN id = p_image_id THEN 0 ELSE 1 END,
            position,
            created_at,
            id
        ) - 1
      )::integer AS new_position
    FROM public.catalog_item_images
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
  )
  UPDATE public.catalog_item_images AS image
  SET position = ranked.new_position
  FROM ranked
  WHERE image.id = ranked.id
    AND image.item_id = p_item_id
    AND image.organization_id = p_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_catalog_primary_image(
  uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_catalog_primary_image(
  uuid, uuid, uuid
) TO authenticated;