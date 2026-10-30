BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(20);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

-- Small limits make the boundary tests fast.
-- Everything in this file rolls back.
UPDATE private.catalog_capacity_limits
SET
  max_templates = 2,
  max_versions_per_template = 2,
  max_items = 2,
  max_image_slots = 2,
  max_sections_per_item = 2
WHERE plan_id = 'free';

-- =========================================================
-- Isolated fixtures
-- =========================================================

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_template uuid := gen_random_uuid();
  v_version uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at
  )
  VALUES
    (
      v_owner,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'capacity-owner-' || v_owner::text || '@example.com',
      '',
      now()
    ),
    (
      v_outsider,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'capacity-outsider-' || v_outsider::text || '@example.com',
      '',
      now()
    );

  INSERT INTO public.organizations (id, name, slug)
  VALUES (
    v_org,
    'Catalog Capacity Test',
    'capacity-' || v_org::text
  );

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status
  )
  VALUES (v_org, v_owner, 'owner', 'active');

  INSERT INTO public.catalog_templates (
    id, organization_id, name, kind
  )
  VALUES (v_template, v_org, 'Capacity Template', 'product');

  INSERT INTO public.catalog_template_versions (
    id, organization_id, template_id, version_number, fields
  )
  VALUES (v_version, v_org, v_template, 1, '[]'::jsonb);

  UPDATE public.catalog_template_versions
  SET status = 'active'
  WHERE id = v_version;

  INSERT INTO public.catalog_items (
    id, organization_id, template_version_id, name, slug
  )
  VALUES (
    v_item,
    v_org,
    v_version,
    'First capacity item',
    'first-capacity-item'
  );

  PERFORM set_config('test.capacity_owner', v_owner::text, true);
  PERFORM set_config('test.capacity_outsider', v_outsider::text, true);
  PERFORM set_config('test.capacity_org', v_org::text, true);
  PERFORM set_config('test.capacity_template', v_template::text, true);
  PERFORM set_config('test.capacity_version', v_version::text, true);
  PERFORM set_config('test.capacity_item', v_item::text, true);
  PERFORM set_config(
    'test.capacity_second_item',
    gen_random_uuid()::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.capacity_owner'),
  true
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('test.capacity_owner'),
    'role', 'authenticated'
  )::text,
  true
);

-- 1. Allocation at the template boundary succeeds.
SELECT lives_ok(
  $$
    INSERT INTO public.catalog_templates (
      organization_id, name, kind
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      'Second template',
      'service'
    )
  $$,
  'A template can fill the final available slot'
);

-- 2. Direct inserts cannot exceed the template limit.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_templates (
      organization_id, name, kind
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      'Over-limit template',
      'product'
    )
  $$,
  'P0001',
  'Catalog limit reached for templates',
  'Direct template inserts enforce capacity'
);

-- 3. A second version is allowed.
SELECT lives_ok(
  $$
    INSERT INTO public.catalog_template_versions (
      organization_id, template_id, version_number, fields
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_template')::uuid,
      2,
      '[]'::jsonb
    )
  $$,
  'A template can fill its final version slot'
);

-- 4. Historical versions count toward the limit.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_template_versions (
      organization_id, template_id, version_number, fields
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_template')::uuid,
      3,
      '[]'::jsonb
    )
  $$,
  'P0001',
  'Catalog limit reached for template_versions',
  'Template version capacity is enforced'
);

-- 5. A second item is allowed.
SELECT lives_ok(
  $$
    INSERT INTO public.catalog_items (
      id, organization_id, template_version_id, name, slug
    )
    VALUES (
      current_setting('test.capacity_second_item')::uuid,
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_version')::uuid,
      'Second capacity item',
      'second-capacity-item'
    )
  $$,
  'An item can fill the final available slot'
);

-- 6. Direct item inserts enforce capacity.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_items (
      organization_id, template_version_id, name, slug
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_version')::uuid,
      'Over-limit item',
      'over-limit-item'
    )
  $$,
  'P0001',
  'Catalog limit reached for items',
  'Direct item inserts enforce capacity'
);

-- 7. Sections can fill the available capacity.
SELECT lives_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id, item_id, kind, title, position, content
    )
    SELECT
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_item')::uuid,
      'text',
      'Section ' || n::text,
      n,
      '{"text":"Capacity test content"}'::jsonb
    FROM generate_series(1, 2) AS entries(n)
  $$,
  'Sections can fill the available capacity'
);

-- 8. Direct inserts cannot bypass the section limit.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id, item_id, kind, title, content
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_item')::uuid,
      'text',
      'Over-limit section',
      '{"text":"Not permitted"}'::jsonb
    )
  $$,
  'P0001',
  'Catalog limit reached for sections',
  'Direct section inserts enforce capacity'
);

-- 9. An oversized bulk insert fails.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id, item_id, kind, title, position, content
    )
    SELECT
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_second_item')::uuid,
      'text',
      'Bulk section ' || n::text,
      n,
      '{"text":"Bulk capacity test"}'::jsonb
    FROM generate_series(1, 3) AS entries(n)
  $$,
  'P0001',
  'Catalog limit reached for sections',
  'An oversized bulk insert is rejected'
);

-- 10. No partial bulk import remains.
SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_sections
    WHERE item_id =
      current_setting('test.capacity_second_item')::uuid
  ),
  0::bigint,
  'A rejected bulk insert rolls back every inserted row'
);

-- 11. Reserve both image slots.
SELECT lives_ok(
  $$
    INSERT INTO public.catalog_item_images (
      organization_id, item_id, file_extension, position
    )
    SELECT
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_item')::uuid,
      'webp',
      n
    FROM generate_series(1, 2) AS entries(n)
  $$,
  'Image reservations can fill organization capacity'
);

-- 12. Another item does not receive a separate organization quota.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_images (
      organization_id, item_id, file_extension
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_second_item')::uuid,
      'webp'
    )
  $$,
  'P0001',
  'Catalog limit reached for image_slots',
  'Image capacity is shared across the organization'
);

-- 13. Existing reservations can still be uploaded at capacity.
SELECT ok(
  private.can_upload_catalog_image(
    (
      SELECT object_path
      FROM public.catalog_item_images
      WHERE item_id = current_setting('test.capacity_item')::uuid
        AND position = 1
    )
  ),
  'Uploading a reserved image does not require an extra slot'
);

-- 14. Clients cannot read internal quota configuration.
SELECT throws_ok(
  $$ SELECT * FROM private.catalog_capacity_limits $$,
  '42501',
  NULL,
  'Authenticated clients cannot read internal quota configuration'
);

-- Switch to an outsider.
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.capacity_outsider'),
  true
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('test.capacity_outsider'),
    'role', 'authenticated'
  )::text,
  true
);

-- 15. Knowing a reservation path does not grant upload access.
SELECT is(
  private.can_upload_catalog_image(
    current_setting('test.capacity_org') || '/' ||
    current_setting('test.capacity_item') || '/not-a-reservation.webp'
  ),
  false,
  'An outsider cannot authorize an upload'
);

-- 16. The quota trigger preserves tenant authorization.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_items (
      organization_id, template_version_id, name, slug
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_version')::uuid,
      'Unauthorized item',
      'unauthorized-item'
    )
  $$,
  '42501',
  NULL,
  'An outsider cannot allocate catalog resources'
);

-- =========================================================
-- Storage accounting fixture
-- Local metadata-only fixture; no real file is uploaded.
-- This transaction rolls back.
-- =========================================================

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

SELECT set_config(
  'test.capacity_uploaded_path',
  (
    SELECT object_path
    FROM public.catalog_item_images
    WHERE item_id = current_setting('test.capacity_item')::uuid
      AND position = 1
  ),
  true
);

INSERT INTO storage.objects (bucket_id, name, metadata)
VALUES (
  'catalog-images',
  current_setting('test.capacity_uploaded_path'),
  '{"size":1024}'::jsonb
);

-- 17. Reservation plus matching file counts once.
SELECT is(
  private.get_catalog_image_slots_used(
    current_setting('test.capacity_org')::uuid
  ),
  2::bigint,
  'Matching reservations and files are not double-counted'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('test.capacity_owner'),
  true
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('test.capacity_owner'),
    'role', 'authenticated'
  )::text,
  true
);

-- 18. Exercise the direct deletion path that leaves a file behind.
SELECT results_eq(
  $$
    DELETE FROM public.catalog_item_images
    WHERE object_path = current_setting('test.capacity_uploaded_path')
    RETURNING object_path
  $$,
  $$ SELECT current_setting('test.capacity_uploaded_path') $$,
  'The fixture removes the gallery record but retains file metadata'
);

-- 19. Deleting that record does not release storage capacity.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_images (
      organization_id, item_id, file_extension
    )
    VALUES (
      current_setting('test.capacity_org')::uuid,
      current_setting('test.capacity_second_item')::uuid,
      'webp'
    )
  $$,
  'P0001',
  'Catalog limit reached for image_slots',
  'Files without gallery records still consume capacity'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

-- 20. One remaining reservation plus one orphan still equals two.
SELECT is(
  private.get_catalog_image_slots_used(
    current_setting('test.capacity_org')::uuid
  ),
  2::bigint,
  'Deleting a gallery record does not erase its storage accounting'
);

SELECT * FROM finish();

ROLLBACK;