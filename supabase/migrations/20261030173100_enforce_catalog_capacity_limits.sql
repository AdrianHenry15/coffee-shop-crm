-- =========================================================
-- Catalog capacity configuration
-- Internal configuration; clients cannot edit these limits.
-- =========================================================

CREATE TABLE private.catalog_capacity_limits (
  plan_id text PRIMARY KEY
    REFERENCES public.billing_plans(id)
    ON DELETE RESTRICT,

  max_templates integer NOT NULL CHECK (max_templates > 0),
  max_versions_per_template integer NOT NULL
    CHECK (max_versions_per_template > 0),
  max_items integer NOT NULL CHECK (max_items > 0),
  max_image_slots integer NOT NULL CHECK (max_image_slots > 0),
  max_sections_per_item integer NOT NULL
    CHECK (max_sections_per_item > 0)
);

REVOKE ALL ON private.catalog_capacity_limits
FROM PUBLIC, anon, authenticated;

INSERT INTO private.catalog_capacity_limits (
  plan_id,
  max_templates,
  max_versions_per_template,
  max_items,
  max_image_slots,
  max_sections_per_item
)
VALUES
  ('free',      5,  20,   25,   20, 30),
  ('starter',  25,  50,  250,  200, 30),
  ('pro',     100, 100, 1000, 1000, 30);

-- =========================================================
-- Resolve a catalog resource limit.
-- Existing contact limits and Partner benefits are unchanged.
-- =========================================================

CREATE FUNCTION private.get_catalog_capacity_limit(
  p_organization_id uuid,
  p_resource text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_status text;
BEGIN
  IF p_resource NOT IN (
    'templates',
    'template_versions',
    'items',
    'image_slots',
    'sections'
  ) THEN
    RAISE EXCEPTION 'Unsupported catalog resource'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    s.status,
    CASE p_resource
      WHEN 'templates' THEN l.max_templates
      WHEN 'template_versions' THEN l.max_versions_per_template
      WHEN 'items' THEN l.max_items
      WHEN 'image_slots' THEN l.max_image_slots
      WHEN 'sections' THEN l.max_sections_per_item
    END
  INTO v_status, v_limit
  FROM public.organization_subscriptions AS s
  JOIN private.catalog_capacity_limits AS l
    ON l.plan_id = s.plan_id
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog subscription configuration not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'Organization subscription is not active'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_limit;
END;
$$;

REVOKE ALL ON FUNCTION
  private.get_catalog_capacity_limit(uuid, text)
FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Count reservations and stored files together.
--
-- A stored file remains charged even if its gallery record
-- or parent item has been deleted.
-- =========================================================

CREATE FUNCTION private.get_catalog_image_slots_used(
  p_organization_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)
  FROM (
    SELECT image.object_path AS path
    FROM public.catalog_item_images AS image
    WHERE image.organization_id = p_organization_id

    UNION

    SELECT object.name AS path
    FROM storage.objects AS object
    WHERE object.bucket_id = 'catalog-images'
      AND split_part(object.name, '/', 1) =
        p_organization_id::text
  ) AS charged_paths;
$$;

REVOKE ALL ON FUNCTION
  private.get_catalog_image_slots_used(uuid)
FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Enforce capacity for direct inserts and RPC inserts.
-- Organization locking serializes competing allocations.
-- =========================================================

CREATE FUNCTION private.enforce_catalog_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resource text;
  v_limit integer;
  v_count bigint;
BEGIN
  -- Authenticated callers must have catalog-management access.
  -- Privileged migrations and service operations may have no
  -- auth.uid(), but still receive the same capacity checks.
  IF (SELECT auth.uid()) IS NOT NULL
    AND NOT private.can_manage_catalog(NEW.organization_id)
  THEN
    RAISE EXCEPTION 'Catalog management access required'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.organizations
  WHERE id = NEW.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = '23503';
  END IF;

  v_resource := CASE TG_TABLE_NAME
    WHEN 'catalog_templates' THEN 'templates'
    WHEN 'catalog_template_versions' THEN 'template_versions'
    WHEN 'catalog_items' THEN 'items'
    WHEN 'catalog_item_images' THEN 'image_slots'
    WHEN 'catalog_item_sections' THEN 'sections'
    ELSE NULL
  END;

  IF v_resource IS NULL THEN
    RAISE EXCEPTION 'Unsupported catalog resource'
      USING ERRCODE = '22023';
  END IF;

  v_limit := private.get_catalog_capacity_limit(
    NEW.organization_id,
    v_resource
  );

  CASE TG_TABLE_NAME
    WHEN 'catalog_templates' THEN
      SELECT count(*) INTO v_count
      FROM public.catalog_templates
      WHERE organization_id = NEW.organization_id;

    WHEN 'catalog_template_versions' THEN
      SELECT count(*) INTO v_count
      FROM public.catalog_template_versions
      WHERE organization_id = NEW.organization_id
        AND template_id = NEW.template_id;

    WHEN 'catalog_items' THEN
      SELECT count(*) INTO v_count
      FROM public.catalog_items
      WHERE organization_id = NEW.organization_id;

    WHEN 'catalog_item_images' THEN
      v_count := private.get_catalog_image_slots_used(
        NEW.organization_id
      );

    WHEN 'catalog_item_sections' THEN
      SELECT count(*) INTO v_count
      FROM public.catalog_item_sections
      WHERE organization_id = NEW.organization_id
        AND item_id = NEW.item_id;
  END CASE;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Catalog limit reached for %', v_resource
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_catalog_capacity()
FROM PUBLIC, anon, authenticated;

-- Run capacity checks before the existing guard triggers.
-- Existing validation and RLS policies remain in place.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'catalog_templates',
    'catalog_template_versions',
    'catalog_items',
    'catalog_item_images',
    'catalog_item_sections'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER a_enforce_catalog_capacity
       BEFORE INSERT ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION private.enforce_catalog_capacity()',
      v_table
    );
  END LOOP;
END;
$$;

-- =========================================================
-- Recheck capacity when a reserved file is uploaded.
--
-- Lock the reservation until the Storage metadata transaction
-- finishes so it cannot be deleted during authorization.
-- =========================================================

CREATE FUNCTION private.can_upload_catalog_image(
  p_object_path text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_limit integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN false;
  END IF;

  SELECT image.organization_id
  INTO v_organization_id
  FROM public.catalog_item_images AS image
  WHERE image.object_path = p_object_path;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT private.can_manage_catalog(v_organization_id) THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.organizations
  WHERE id = v_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Recheck after obtaining the organization lock.
  PERFORM 1
  FROM public.catalog_item_images
  WHERE object_path = p_object_path
    AND organization_id = v_organization_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_limit := private.get_catalog_capacity_limit(
    v_organization_id,
    'image_slots'
  );

  -- The file being uploaded already has a charged reservation.
  RETURN private.get_catalog_image_slots_used(
    v_organization_id
  ) <= v_limit;
END;
$$;

REVOKE ALL ON FUNCTION private.can_upload_catalog_image(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.can_upload_catalog_image(text)
TO authenticated;

DROP POLICY "Catalog managers can upload reserved image files"
ON storage.objects;

CREATE POLICY "Catalog managers can upload reserved image files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'catalog-images'
  AND private.can_upload_catalog_image(name)
);