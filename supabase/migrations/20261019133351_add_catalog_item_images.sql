-- =========================================================
-- Private catalog image storage
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'catalog-images',
  'catalog-images',
  false,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
);

-- =========================================================
-- Image records
--
-- Reserve a record before uploading its file.
-- The generated path binds each file to its organization,
-- catalog item, and image record.
-- =========================================================

CREATE TABLE public.catalog_item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL,

  item_id uuid NOT NULL,

  file_extension text NOT NULL
    CHECK (file_extension IN ('jpg', 'png', 'webp')),

  object_path text GENERATED ALWAYS AS (
    organization_id::text || '/' ||
    item_id::text || '/' ||
    id::text || '.' || file_extension
  ) STORED,

  alt_text text NOT NULL DEFAULT ''
    CHECK (length(alt_text) <= 500),

  position integer NOT NULL DEFAULT 0
    CHECK (position >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_item_images_item_fk
    FOREIGN KEY (item_id, organization_id)
    REFERENCES public.catalog_items (id, organization_id)
    ON DELETE CASCADE,

  CONSTRAINT catalog_item_images_object_path_unique
    UNIQUE (object_path)
);

CREATE INDEX catalog_item_images_gallery_idx
  ON public.catalog_item_images (
    organization_id,
    item_id,
    position,
    created_at,
    id
  );

-- =========================================================
-- Image record guard
-- =========================================================

CREATE OR REPLACE FUNCTION private.guard_catalog_item_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_image_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.item_id IS DISTINCT FROM OLD.item_id
      OR NEW.file_extension IS DISTINCT FROM OLD.file_extension
    THEN
      RAISE EXCEPTION 'Image identity and file path cannot be changed'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;

  -- Serialize image reservations for this item.
  PERFORM 1
  FROM public.catalog_items
  WHERE id = NEW.item_id
    AND organization_id = NEW.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*)
    INTO v_image_count
    FROM public.catalog_item_images
    WHERE item_id = NEW.item_id
      AND organization_id = NEW.organization_id;

    IF v_image_count >= 20 THEN
      RAISE EXCEPTION 'A catalog item can have up to 20 images'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.alt_text := btrim(NEW.alt_text);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_item_image()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_catalog_item_image
BEFORE INSERT OR UPDATE
ON public.catalog_item_images
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_item_image();

-- =========================================================
-- Image record access
-- =========================================================

ALTER TABLE public.catalog_item_images
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.catalog_item_images
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.catalog_item_images
TO authenticated;

CREATE POLICY "Members can read catalog image records"
ON public.catalog_item_images
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_org_member(organization_id))
);

CREATE POLICY "Catalog managers can insert image records"
ON public.catalog_item_images
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT private.can_manage_catalog(organization_id))
);

CREATE POLICY "Catalog managers can update image records"
ON public.catalog_item_images
FOR UPDATE
TO authenticated
USING (
  (SELECT private.can_manage_catalog(organization_id))
)
WITH CHECK (
  (SELECT private.can_manage_catalog(organization_id))
);

CREATE POLICY "Catalog managers can delete image records"
ON public.catalog_item_images
FOR DELETE
TO authenticated
USING (
  (SELECT private.can_manage_catalog(organization_id))
);

-- =========================================================
-- Storage access
--
-- Uploads require an existing image reservation.
-- File replacement is intentionally unsupported:
-- replacing an image creates a new record and file.
-- =========================================================

CREATE POLICY "Members can read catalog image files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'catalog-images'
  AND EXISTS (
    SELECT 1
    FROM public.catalog_item_images AS image
    WHERE image.object_path = storage.objects.name
      AND private.is_org_member(image.organization_id)
  )
);

CREATE POLICY "Catalog managers can upload reserved image files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'catalog-images'
  AND EXISTS (
    SELECT 1
    FROM public.catalog_item_images AS image
    WHERE image.object_path = storage.objects.name
      AND private.can_manage_catalog(image.organization_id)
  )
);

-- Managers can also clean up files whose image record was
-- removed, provided the parent catalog item still exists.
CREATE POLICY "Catalog managers can delete catalog image files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'catalog-images'
  AND EXISTS (
    SELECT 1
    FROM public.catalog_items AS item
    WHERE item.organization_id::text =
      split_part(storage.objects.name, '/', 1)
      AND item.id::text =
        split_part(storage.objects.name, '/', 2)
      AND private.can_manage_catalog(item.organization_id)
  )
);