BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT no_plan();

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

-- All fixtures and cleanup changes roll back.
-- Storage fixtures contain metadata only, not actual uploaded files.

DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_template uuid := gen_random_uuid();
  v_version uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_live uuid := gen_random_uuid();
  v_abandoned uuid := gen_random_uuid();
  v_fresh uuid := gen_random_uuid();
  v_deleted uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organizations (id, name, slug)
  VALUES (
    v_org,
    'Image Cleanup Test',
    'cleanup-' || v_org::text
  );

  INSERT INTO public.catalog_templates (
    id, organization_id, name, kind
  )
  VALUES (
    v_template, v_org, 'Cleanup Template', 'product'
  );

  INSERT INTO public.catalog_template_versions (
    id, organization_id, template_id, version_number, fields
  )
  VALUES (
    v_version, v_org, v_template, 1, '[]'::jsonb
  );

  UPDATE public.catalog_template_versions
  SET status = 'active'
  WHERE id = v_version;

  INSERT INTO public.catalog_items (
    id, organization_id, template_version_id, name, slug
  )
  VALUES (
    v_item, v_org, v_version,
    'Cleanup item', 'cleanup-item'
  );

  INSERT INTO public.catalog_item_images (
    id, organization_id, item_id, file_extension, position
  )
  VALUES
    (v_live, v_org, v_item, 'webp', 0),
    (v_abandoned, v_org, v_item, 'webp', 1),
    (v_fresh, v_org, v_item, 'webp', 2),
    (v_deleted, v_org, v_item, 'webp', 3);

  PERFORM set_config('test.cleanup_org', v_org::text, true);
  PERFORM set_config('test.cleanup_item', v_item::text, true);
  PERFORM set_config('test.cleanup_live', v_live::text, true);
  PERFORM set_config(
    'test.cleanup_abandoned', v_abandoned::text, true
  );
  PERFORM set_config('test.cleanup_fresh', v_fresh::text, true);
  PERFORM set_config('test.cleanup_deleted', v_deleted::text, true);

  PERFORM set_config(
    'test.cleanup_live_path',
    v_org::text || '/' || v_item::text || '/' ||
      v_live::text || '.webp',
    true
  );

  PERFORM set_config(
    'test.cleanup_deleted_path',
    v_org::text || '/' || v_item::text || '/' ||
      v_deleted::text || '.webp',
    true
  );

  PERFORM set_config(
    'test.cleanup_orphan_path',
    v_org::text || '/' || v_item::text || '/' ||
      gen_random_uuid()::text || '.webp',
    true
  );

  PERFORM set_config(
    'test.cleanup_missing_path',
    v_org::text || '/' || v_item::text || '/' ||
      gen_random_uuid()::text || '.webp',
    true
  );
END;
$$;

-- Only disable the timestamp guard while aging test fixtures.
ALTER TABLE public.catalog_item_images
DISABLE TRIGGER guard_catalog_item_image;

UPDATE public.catalog_item_images
SET created_at = now() - interval '2 days'
WHERE id IN (
  current_setting('test.cleanup_live')::uuid,
  current_setting('test.cleanup_abandoned')::uuid
);

ALTER TABLE public.catalog_item_images
ENABLE TRIGGER guard_catalog_item_image;

INSERT INTO storage.objects (
  bucket_id, name, metadata, created_at
)
VALUES
  (
    'catalog-images',
    current_setting('test.cleanup_live_path'),
    '{"size":1024}'::jsonb,
    now() - interval '2 days'
  ),
  (
    'catalog-images',
    current_setting('test.cleanup_deleted_path'),
    '{"size":1024}'::jsonb,
    now()
  ),
  (
    'catalog-images',
    current_setting('test.cleanup_orphan_path'),
    '{"size":1024}'::jsonb,
    now() - interval '2 days'
  );

DELETE FROM public.catalog_item_images
WHERE id = current_setting('test.cleanup_deleted')::uuid;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM private.catalog_image_cleanup_jobs
    WHERE object_path = current_setting('test.cleanup_deleted_path')
      AND completed_at IS NULL
      AND not_before > clock_timestamp()
  ),
  'Deleting a gallery record queues its stored file with a grace period'
);

SELECT is(
  private.get_catalog_image_slots_used(
    current_setting('test.cleanup_org')::uuid
  ),
  5::bigint,
  'Matching files and cleanup jobs count once toward capacity'
);

-- Actual calls verify that browser-facing roles cannot run cleanup.
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT * FROM public.claim_catalog_image_cleanup(100) $$,
  '42501',
  NULL,
  'Anonymous users cannot claim cleanup jobs'
);

SELECT throws_ok(
  $$
    SELECT public.complete_catalog_image_cleanup(
      ARRAY['untrusted-path'],
      gen_random_uuid()
    )
  $$,
  '42501',
  NULL,
  'Anonymous users cannot complete cleanup jobs'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT * FROM public.claim_catalog_image_cleanup(100) $$,
  '42501',
  NULL,
  'Authenticated users cannot claim cleanup jobs'
);

SELECT throws_ok(
  $$
    SELECT public.complete_catalog_image_cleanup(
      ARRAY['untrusted-path'],
      gen_random_uuid()
    )
  $$,
  '42501',
  NULL,
  'Authenticated users cannot complete cleanup jobs'
);

SELECT throws_ok(
  $$ SELECT * FROM private.catalog_image_cleanup_jobs $$,
  '42501',
  NULL,
  'Authenticated users cannot read the private cleanup queue'
);

RESET ROLE;

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.claim_catalog_image_cleanup(integer)',
    'EXECUTE'
  ),
  'The service role can claim cleanup jobs'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.complete_catalog_image_cleanup(text[],uuid)',
    'EXECUTE'
  ),
  'The service role can complete cleanup jobs'
);

SELECT throws_ok(
  $$ SELECT * FROM public.claim_catalog_image_cleanup(101) $$,
  '22023',
  NULL,
  'Oversized cleanup batches are rejected'
);

-- Also exercises orphan discovery and its ON CONFLICT clause.
CREATE TEMP TABLE cleanup_first_claim AS
SELECT * FROM public.claim_catalog_image_cleanup(100);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.catalog_item_images
    WHERE id = current_setting('test.cleanup_live')::uuid
  ),
  'An older image with a stored file is preserved'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'catalog-images'
      AND name = current_setting('test.cleanup_live_path')
  ),
  'Claiming cleanup never deletes the live file metadata'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.catalog_item_images
    WHERE id = current_setting('test.cleanup_abandoned')::uuid
  ),
  'An abandoned reservation older than 24 hours is released'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.catalog_item_images
    WHERE id = current_setting('test.cleanup_fresh')::uuid
  ),
  'A recent unused reservation is preserved'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM cleanup_first_claim
    WHERE object_path = current_setting('test.cleanup_orphan_path')
      AND lease_token IS NOT NULL
  ),
  'An older orphan file is discovered and leased'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM cleanup_first_claim
    WHERE object_path IN (
      current_setting('test.cleanup_live_path'),
      current_setting('test.cleanup_deleted_path')
    )
  ),
  'Live images and jobs within their grace period are excluded'
);

SELECT is(
  public.complete_catalog_image_cleanup(
    ARRAY[current_setting('test.cleanup_orphan_path')],
    (
      SELECT lease_token
      FROM cleanup_first_claim
      WHERE object_path = current_setting('test.cleanup_orphan_path')
    )
  ),
  0,
  'A job cannot complete while its stored file still exists'
);

-- Make the deleted-image job eligible without waiting 24 hours.
UPDATE private.catalog_image_cleanup_jobs
SET not_before = now() - interval '1 minute'
WHERE object_path = current_setting('test.cleanup_deleted_path');

CREATE TEMP TABLE cleanup_second_claim AS
SELECT * FROM public.claim_catalog_image_cleanup(100);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM cleanup_second_claim
    WHERE object_path = current_setting('test.cleanup_deleted_path')
  ),
  'A queued deletion becomes eligible after its grace period'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM cleanup_second_claim
    WHERE object_path = current_setting('test.cleanup_orphan_path')
  ),
  'An active lease prevents another claim from taking the same job'
);

-- Expire the orphan lease to simulate a failed worker.
UPDATE private.catalog_image_cleanup_jobs
SET lease_until = now() - interval '1 minute'
WHERE object_path = current_setting('test.cleanup_orphan_path');

CREATE TEMP TABLE cleanup_retry_claim AS
SELECT * FROM public.claim_catalog_image_cleanup(100);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM cleanup_retry_claim AS retry
    JOIN cleanup_first_claim AS original USING (object_path)
    WHERE retry.object_path = current_setting('test.cleanup_orphan_path')
      AND retry.lease_token <> original.lease_token
  ),
  'An expired lease can be retried with a new token'
);

SELECT is(
  public.complete_catalog_image_cleanup(
    ARRAY[current_setting('test.cleanup_orphan_path')],
    (
      SELECT lease_token
      FROM cleanup_first_claim
      WHERE object_path = current_setting('test.cleanup_orphan_path')
    )
  ),
  0,
  'A superseded worker cannot complete a retried job'
);

-- A separate job represents a file already absent from Storage.
INSERT INTO private.catalog_image_cleanup_jobs (
  object_path, organization_id, not_before
)
VALUES (
  current_setting('test.cleanup_missing_path'),
  current_setting('test.cleanup_org')::uuid,
  now() - interval '1 minute'
);

CREATE TEMP TABLE cleanup_missing_claim AS
SELECT * FROM public.claim_catalog_image_cleanup(100);

SELECT is(
  public.complete_catalog_image_cleanup(
    ARRAY[current_setting('test.cleanup_missing_path')],
    gen_random_uuid()
  ),
  0,
  'An incorrect lease token cannot complete a job'
);

SELECT is(
  private.get_catalog_image_slots_used(
    current_setting('test.cleanup_org')::uuid
  ),
  5::bigint,
  'Pending cleanup remains charged even when its file is absent'
);

SELECT is(
  public.complete_catalog_image_cleanup(
    ARRAY[current_setting('test.cleanup_missing_path')],
    (
      SELECT lease_token
      FROM cleanup_missing_claim
      WHERE object_path = current_setting('test.cleanup_missing_path')
    )
  ),
  1,
  'The current lease can complete a job after its file is absent'
);

SELECT is(
  private.get_catalog_image_slots_used(
    current_setting('test.cleanup_org')::uuid
  ),
  4::bigint,
  'Completed cleanup releases its capacity'
);

SELECT is(
  public.complete_catalog_image_cleanup(
    ARRAY[current_setting('test.cleanup_missing_path')],
    (
      SELECT lease_token
      FROM cleanup_missing_claim
      WHERE object_path = current_setting('test.cleanup_missing_path')
    )
  ),
  0,
  'Repeated completion does not complete a job twice'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_images (
      id, organization_id, item_id, file_extension
    )
    VALUES (
      split_part(
        split_part(current_setting('test.cleanup_missing_path'), '/', 3),
        '.',
        1
      )::uuid,
      current_setting('test.cleanup_org')::uuid,
      current_setting('test.cleanup_item')::uuid,
      'webp'
    )
  $$,
  '23514',
  'A deleted image path cannot be reused',
  'A completed cleanup tombstone prevents immediate path reuse'
);

SELECT * FROM finish();

ROLLBACK;