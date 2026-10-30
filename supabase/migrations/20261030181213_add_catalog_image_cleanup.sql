-- =========================================================
-- Private cleanup queue
-- No foreign keys: jobs must survive item/organization deletion.
-- Completed jobs temporarily prevent reuse of deleted paths.
-- =========================================================

CREATE TABLE private.catalog_image_cleanup_jobs (
  object_path text PRIMARY KEY,
  organization_id uuid NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  not_before timestamptz NOT NULL
    DEFAULT (now() + interval '24 hours'),

  lease_token uuid,
  lease_until timestamptz,
  attempts bigint NOT NULL DEFAULT 0,

  completed_at timestamptz
);

REVOKE ALL ON private.catalog_image_cleanup_jobs
FROM PUBLIC, anon, authenticated;

CREATE INDEX catalog_image_cleanup_pending_idx
ON private.catalog_image_cleanup_jobs (not_before, object_path)
WHERE completed_at IS NULL;

CREATE INDEX catalog_image_cleanup_completed_idx
ON private.catalog_image_cleanup_jobs (completed_at)
WHERE completed_at IS NOT NULL;

CREATE INDEX catalog_images_cleanup_age_idx
ON public.catalog_item_images (created_at, id);

-- =========================================================
-- Keep pending cleanup charged against image capacity.
-- Matching reservation/file/job paths count only once.
-- =========================================================

CREATE OR REPLACE FUNCTION private.get_catalog_image_slots_used(
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

    UNION

    SELECT job.object_path AS path
    FROM private.catalog_image_cleanup_jobs AS job
    WHERE job.organization_id = p_organization_id
      AND job.completed_at IS NULL
  ) AS charged_paths;
$$;

REVOKE ALL ON FUNCTION
  private.get_catalog_image_slots_used(uuid)
FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Coordinate reservation insertion/deletion.
-- Paths queued for cleanup cannot be attached to a new record.
-- =========================================================

CREATE FUNCTION private.guard_catalog_image_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_path text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1
    FROM public.organizations
    WHERE id = OLD.organization_id
    FOR UPDATE;

    RETURN OLD;
  END IF;

  -- Generated columns are not populated yet in BEFORE triggers.
  v_path :=
    NEW.organization_id::text || '/' ||
    NEW.item_id::text || '/' ||
    NEW.id::text || '.' || NEW.file_extension;

  IF EXISTS (
    SELECT 1
    FROM private.catalog_image_cleanup_jobs AS job
    WHERE job.object_path = v_path
  ) THEN
    RAISE EXCEPTION 'A deleted image path cannot be reused'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_image_cleanup()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER b_guard_catalog_image_cleanup
BEFORE INSERT OR DELETE
ON public.catalog_item_images
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_image_cleanup();

-- =========================================================
-- Queue stored files when their gallery record is deleted.
-- Normal UI deletion already removes Storage first, so it
-- usually needs no cleanup job.
-- =========================================================

CREATE FUNCTION private.queue_deleted_catalog_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'catalog-images'
      AND object.name = OLD.object_path
  ) THEN
    INSERT INTO private.catalog_image_cleanup_jobs (
      object_path,
      organization_id
    )
    VALUES (
      OLD.object_path,
      OLD.organization_id
    )
    ON CONFLICT (object_path) DO NOTHING;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.queue_deleted_catalog_image()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER queue_deleted_catalog_image
AFTER DELETE
ON public.catalog_item_images
FOR EACH ROW
EXECUTE FUNCTION private.queue_deleted_catalog_image();

-- =========================================================
-- Uploads must begin within one hour of reservation creation.
-- Existing uploaded images remain readable.
-- =========================================================

CREATE OR REPLACE FUNCTION private.can_upload_catalog_image(
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

  PERFORM 1
  FROM public.catalog_item_images AS image
  WHERE image.object_path = p_object_path
    AND image.organization_id = v_organization_id
    AND image.created_at >
      clock_timestamp() - interval '1 hour'
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.catalog_image_cleanup_jobs AS job
    WHERE job.object_path = p_object_path
  ) THEN
    RETURN false;
  END IF;

  v_limit := private.get_catalog_capacity_limit(
    v_organization_id,
    'image_slots'
  );

  RETURN private.get_catalog_image_slots_used(
    v_organization_id
  ) <= v_limit;
END;
$$;

REVOKE ALL ON FUNCTION private.can_upload_catalog_image(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.can_upload_catalog_image(text)
TO authenticated;

-- =========================================================
-- Service-only preparation and claiming.
-- No Storage objects are deleted through SQL.
-- =========================================================

CREATE FUNCTION public.claim_catalog_image_cleanup(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  object_path text,
  lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate record;
  v_token uuid := gen_random_uuid();
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Cleanup batch size must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  -- Remove old completed tombstones in bounded batches.
  DELETE FROM private.catalog_image_cleanup_jobs AS job
  USING (
    SELECT existing.object_path
    FROM private.catalog_image_cleanup_jobs AS existing
    WHERE existing.completed_at <
      clock_timestamp() - interval '7 days'
    ORDER BY existing.completed_at, existing.object_path
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) AS expired
  WHERE job.object_path = expired.object_path;

  -- Release abandoned reservations only when no file exists.
  FOR v_candidate IN
    SELECT image.id, image.organization_id
    FROM public.catalog_item_images AS image
    WHERE image.created_at <
      clock_timestamp() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'catalog-images'
          AND object.name = image.object_path
      )
    ORDER BY image.created_at, image.id
    LIMIT p_limit
  LOOP
    PERFORM 1
    FROM public.organizations
    WHERE id = v_candidate.organization_id
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Recheck after obtaining the organization lock.
    DELETE FROM public.catalog_item_images AS image
    WHERE image.id = v_candidate.id
      AND image.organization_id = v_candidate.organization_id
      AND image.created_at <
        clock_timestamp() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'catalog-images'
          AND object.name = image.object_path
      );
  END LOOP;

  -- Discover older orphan files, including files predating
  -- installation of the deletion queue trigger.
  FOR v_candidate IN
    SELECT
      object.name AS path,
      split_part(object.name, '/', 1)::uuid AS organization_id
    FROM storage.objects AS object
    WHERE object.bucket_id = 'catalog-images'
      AND object.created_at <
        clock_timestamp() - interval '24 hours'
      AND object.name ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
      AND NOT EXISTS (
        SELECT 1
        FROM public.catalog_item_images AS image
        WHERE image.object_path = object.name
      )
      AND NOT EXISTS (
        SELECT 1
        FROM private.catalog_image_cleanup_jobs AS job
        WHERE job.object_path = object.name
      )
    ORDER BY object.created_at, object.name
    LIMIT p_limit
  LOOP
    -- Deleted organizations have no row to lock.
    IF EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE id = v_candidate.organization_id
    ) THEN
      PERFORM 1
      FROM public.organizations
      WHERE id = v_candidate.organization_id
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO private.catalog_image_cleanup_jobs (
      object_path,
      organization_id,
      not_before
    )
    SELECT
      v_candidate.path,
      v_candidate.organization_id,
      clock_timestamp()
    WHERE EXISTS (
      SELECT 1
      FROM storage.objects AS object
      WHERE object.bucket_id = 'catalog-images'
        AND object.name = v_candidate.path
        AND object.created_at <
          clock_timestamp() - interval '24 hours'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalog_item_images AS image
      WHERE image.object_path = v_candidate.path
    )
    ON CONFLICT (object_path) DO NOTHING;
  END LOOP;

  -- Lease jobs so overlapping cron requests do not share work.
  RETURN QUERY
  WITH candidates AS (
    SELECT job.object_path
    FROM private.catalog_image_cleanup_jobs AS job
    WHERE job.completed_at IS NULL
      AND job.not_before <= clock_timestamp()
      AND (
        job.lease_until IS NULL
        OR job.lease_until <= clock_timestamp()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.catalog_item_images AS image
        WHERE image.object_path = job.object_path
      )
    ORDER BY job.not_before, job.object_path
    LIMIT p_limit
    FOR UPDATE OF job SKIP LOCKED
  )
  UPDATE private.catalog_image_cleanup_jobs AS job
  SET
    lease_token = v_token,
    lease_until = clock_timestamp() + interval '10 minutes',
    attempts = job.attempts + 1
  FROM candidates
  WHERE job.object_path = candidates.object_path
  RETURNING job.object_path, job.lease_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_catalog_image_cleanup(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_catalog_image_cleanup(integer)
TO service_role;

-- =========================================================
-- Complete jobs only after Storage confirms removal.
-- Expired or replaced leases cannot complete another run's jobs.
-- =========================================================

CREATE FUNCTION public.complete_catalog_image_cleanup(
  p_paths text[],
  p_lease_token uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completed integer;
BEGIN
  IF p_paths IS NULL
    OR cardinality(p_paths) < 1
    OR cardinality(p_paths) > 100
    OR p_lease_token IS NULL
  THEN
    RAISE EXCEPTION 'Invalid cleanup completion request'
      USING ERRCODE = '22023';
  END IF;

  UPDATE private.catalog_image_cleanup_jobs AS job
  SET
    completed_at = clock_timestamp(),
    lease_token = NULL,
    lease_until = NULL
  WHERE job.object_path = ANY(p_paths)
    AND job.completed_at IS NULL
    AND job.lease_token = p_lease_token
    AND job.lease_until > clock_timestamp()
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects AS object
      WHERE object.bucket_id = 'catalog-images'
        AND object.name = job.object_path
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalog_item_images AS image
      WHERE image.object_path = job.object_path
    );

  GET DIAGNOSTICS v_completed = ROW_COUNT;

  RETURN v_completed;
END;
$$;

REVOKE ALL ON FUNCTION
  public.complete_catalog_image_cleanup(text[], uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.complete_catalog_image_cleanup(text[], uuid)
TO service_role;