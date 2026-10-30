BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET LOCAL search_path = public, extensions;

SELECT no_plan();

-- =========================================================
-- Fixtures
-- =========================================================

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();

  v_org_a uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();

  v_template_a uuid := gen_random_uuid();
  v_template_b uuid := gen_random_uuid();
  v_version_a uuid := gen_random_uuid();
  v_version_b uuid := gen_random_uuid();

  v_item_a uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.catalog_owner', v_owner::text, true);
  PERFORM set_config('test.catalog_admin', v_admin::text, true);
  PERFORM set_config('test.catalog_member', v_member::text, true);
  PERFORM set_config('test.catalog_outsider', v_outsider::text, true);
  PERFORM set_config('test.catalog_org_a', v_org_a::text, true);
  PERFORM set_config('test.catalog_org_b', v_org_b::text, true);
  PERFORM set_config('test.catalog_template_a', v_template_a::text, true);
  PERFORM set_config('test.catalog_version_a', v_version_a::text, true);
  PERFORM set_config('test.catalog_version_b', v_version_b::text, true);
  PERFORM set_config('test.catalog_item_a', v_item_a::text, true);
  PERFORM set_config('test.catalog_item_b', v_item_b::text, true);

  INSERT INTO auth.users (
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data
  )
  SELECT
    actor.id,
    actor.label || '-' || actor.id::text || '@example.test',
    now(),
    '{"first_name":"Catalog","last_name":"Test"}'::jsonb
  FROM (
    VALUES
      (v_owner, 'owner'),
      (v_admin, 'admin'),
      (v_member, 'member'),
      (v_outsider, 'outsider')
  ) AS actor(id, label);

  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (v_org_a, 'Catalog Test A', 'catalog-a-' || v_org_a::text),
    (v_org_b, 'Catalog Test B', 'catalog-b-' || v_org_b::text);

  -- Allow the membership fixtures without hitting Free-plan limits.
  UPDATE public.organization_subscriptions
  SET plan_id = 'pro', status = 'active'
  WHERE organization_id IN (v_org_a, v_org_b);

  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  VALUES
    (v_org_a, v_owner, 'owner', 'active'),
    (v_org_a, v_admin, 'admin', 'active'),
    (v_org_a, v_member, 'member', 'active'),
    (v_org_b, v_outsider, 'owner', 'active');

  INSERT INTO public.catalog_templates (
    id,
    organization_id,
    name,
    kind
  )
  VALUES
    (v_template_a, v_org_a, 'Mower', 'product'),
    (v_template_b, v_org_b, 'Cleaning', 'service');

  INSERT INTO public.catalog_template_versions (
    id,
    organization_id,
    template_id,
    version_number,
    fields
  )
  VALUES
    (
      v_version_a,
      v_org_a,
      v_template_a,
      1,
      '[
        {
          "key": "width",
          "label": "Cutting width",
          "type": "number",
          "required": true,
          "unit": "mm"
        },
        {
          "key": "power",
          "label": "Power source",
          "type": "select",
          "required": true,
          "options": ["Battery", "Petrol"]
        }
      ]'::jsonb
    ),
    (
      v_version_b,
      v_org_b,
      v_template_b,
      1,
      '[]'::jsonb
    );

  UPDATE public.catalog_template_versions
  SET status = 'active'
  WHERE id IN (v_version_a, v_version_b);

  INSERT INTO public.catalog_items (
    id,
    organization_id,
    template_version_id,
    name,
    slug
  )
  VALUES
    (v_item_a, v_org_a, v_version_a, 'Test mower', 'test-mower'),
    (v_item_b, v_org_b, v_version_b, 'Test cleaning', 'test-cleaning');

  INSERT INTO public.catalog_item_sections (
    organization_id,
    item_id,
    kind,
    title,
    content
  )
  VALUES (
    v_org_b,
    v_item_b,
    'text',
    'Description',
    '{"text":"Private organization B content"}'::jsonb
  );
END;
$$;

-- =========================================================
-- Anonymous access
-- =========================================================

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT * FROM public.catalog_templates $$,
  '42501',
  NULL,
  'Anonymous visitors cannot read internal templates'
);

SELECT throws_ok(
  $$ SELECT * FROM public.catalog_items $$,
  '42501',
  NULL,
  'Anonymous visitors cannot read internal items'
);

SELECT throws_ok(
  $$ SELECT * FROM public.catalog_item_sections $$,
  '42501',
  NULL,
  'Anonymous visitors cannot read internal sections'
);

RESET ROLE;

-- =========================================================
-- Organization A owner
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_owner'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_owner'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_templates
    WHERE organization_id =
      current_setting('test.catalog_org_a')::uuid
  ),
  1::bigint,
  'Owner can read their organization template'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_templates
    WHERE organization_id =
      current_setting('test.catalog_org_b')::uuid
  ),
  0::bigint,
  'Owner cannot read another organization templates'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_items
    WHERE organization_id =
      current_setting('test.catalog_org_b')::uuid
  ),
  0::bigint,
  'Owner cannot read another organization items'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_sections
    WHERE organization_id =
      current_setting('test.catalog_org_b')::uuid
  ),
  0::bigint,
  'Owner cannot read another organization sections'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_templates (
      organization_id,
      name,
      kind
    )
    VALUES (
      current_setting('test.catalog_org_b')::uuid,
      'Unauthorized template',
      'product'
    )
  $$,
  '42501',
  NULL,
  'Owner cannot create templates in another organization'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_items (
      organization_id,
      template_version_id,
      name,
      slug
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_version_b')::uuid,
      'Wrong template',
      'wrong-template'
    )
  $$,
  '23503',
  NULL,
  'Items cannot reference another organization template version'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id,
      item_id,
      kind,
      title,
      content
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_item_b')::uuid,
      'text',
      'Unauthorized section',
      '{"text":"Wrong organization"}'::jsonb
    )
  $$,
  '23503',
  NULL,
  'Sections cannot reference another organization item'
);

-- =========================================================
-- Attribute validation and publishing
-- =========================================================

SELECT lives_ok(
  $$
    UPDATE public.catalog_items
    SET attributes = '{}'::jsonb
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  'Draft items can omit required fields'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_items
    SET status = 'published'
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  '23514',
  NULL,
  'Publishing rejects missing required fields'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_items
    SET attributes = '{"unknown_field":"value"}'::jsonb
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  '23514',
  NULL,
  'Unknown attribute keys are rejected'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_items
    SET attributes = '{"width":"860"}'::jsonb
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  '23514',
  NULL,
  'Numeric fields reject string values'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_items
    SET attributes = '{"power":"Steam"}'::jsonb
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  '23514',
  NULL,
  'Selection fields reject undefined options'
);

SELECT lives_ok(
  $$
    UPDATE public.catalog_items
    SET attributes = '{"width":860,"power":"Battery"}'::jsonb
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  'Valid attributes can be saved'
);

SELECT lives_ok(
  $$
    UPDATE public.catalog_items
    SET status = 'published'
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  'Complete items can be published'
);

SELECT ok(
  (
    SELECT published_at IS NOT NULL
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_a')::uuid
  ),
  'Publishing records a publication timestamp'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_items
    SET price_mode = 'fixed', price_cents = NULL
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  '23514',
  NULL,
  'Fixed-price items require a price'
);

-- =========================================================
-- Template version protection
-- =========================================================

SELECT throws_ok(
  $$
    UPDATE public.catalog_template_versions
    SET fields = '[]'::jsonb
    WHERE id = current_setting('test.catalog_version_a')::uuid
  $$,
  '23514',
  NULL,
  'Activated field definitions cannot be modified'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_template_versions
    SET status = 'draft'
    WHERE id = current_setting('test.catalog_version_a')::uuid
  $$,
  '23514',
  NULL,
  'Active versions cannot return to draft'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_items
    SET organization_id = current_setting('test.catalog_org_b')::uuid
    WHERE id = current_setting('test.catalog_item_a')::uuid
  $$,
  '23514',
  NULL,
  'Items cannot be reassigned to another organization'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_template_versions (
      organization_id,
      template_id,
      version_number,
      fields
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_template_a')::uuid,
      2,
      '[
        {"key":"same","label":"First","type":"text","required":false},
        {"key":"same","label":"Second","type":"text","required":false}
      ]'::jsonb
    )
  $$,
  '23514',
  NULL,
  'Duplicate field keys are rejected'
);

-- =========================================================
-- Content section validation
-- =========================================================

SELECT lives_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id,
      item_id,
      kind,
      title,
      content
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_item_a')::uuid,
      'specifications',
      'Specifications',
      '{"field_keys":["width","power"]}'::jsonb
    )
  $$,
  'Specification sections accept defined template fields'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id,
      item_id,
      kind,
      title,
      content
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_item_a')::uuid,
      'specifications',
      'Invalid specifications',
      '{"field_keys":["unknown_field"]}'::jsonb
    )
  $$,
  '23514',
  NULL,
  'Specification sections reject unknown fields'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_sections (
      organization_id,
      item_id,
      kind,
      title,
      content
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_item_a')::uuid,
      'list',
      'Invalid features',
      '{"items":[123]}'::jsonb
    )
  $$,
  '23514',
  NULL,
  'Feature lists reject invalid content types'
);

RESET ROLE;

-- =========================================================
-- Ordinary organization member
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_member'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_member'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_a')::uuid
  ),
  1::bigint,
  'Active members can read their organization catalog'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_templates (
      organization_id,
      name,
      kind
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      'Member-created template',
      'service'
    )
  $$,
  '42501',
  NULL,
  'Ordinary members cannot create templates'
);

-- RLS silently excludes rows the caller cannot update.
UPDATE public.catalog_items
SET name = 'Unauthorized edit'
WHERE id = current_setting('test.catalog_item_a')::uuid;

SELECT is(
  (
    SELECT name
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_a')::uuid
  ),
  'Test mower',
  'Ordinary members cannot modify catalog items'
);

DELETE FROM public.catalog_items
WHERE id = current_setting('test.catalog_item_a')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_a')::uuid
  ),
  1::bigint,
  'Ordinary members cannot delete catalog items'
);

RESET ROLE;

-- =========================================================
-- Delegated organization administrator
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_admin'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_admin'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT lives_ok(
  $$
    INSERT INTO public.catalog_templates (
      organization_id,
      name,
      kind
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      'Admin-created template',
      'service'
    )
  $$,
  'Organization admins can create catalog templates'
);

UPDATE public.catalog_items
SET summary = 'Updated by organization admin'
WHERE id = current_setting('test.catalog_item_a')::uuid;

SELECT is(
  (
    SELECT summary
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_a')::uuid
  ),
  'Updated by organization admin',
  'Organization admins can update catalog items'
);

RESET ROLE;

-- =========================================================
-- Owner of another organization
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_outsider'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_outsider'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_a')::uuid
  ),
  0::bigint,
  'Owning another workspace does not grant access'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_items
    WHERE id = current_setting('test.catalog_item_b')::uuid
  ),
  1::bigint,
  'Other workspace owner can still access their own catalog'
);

RESET ROLE;

-- =========================================================
-- Section saving and image management regression tests
-- =========================================================

RESET ROLE;

-- Privileged fixture setup must not inherit the previous
-- authenticated outsider's identity.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

DO $$
DECLARE
  v_item_id uuid := gen_random_uuid();
  v_image_a uuid := gen_random_uuid();
  v_image_b uuid := gen_random_uuid();
  v_second_image uuid := gen_random_uuid();
BEGIN
  PERFORM set_config(
    'test.catalog_content_item',
    v_item_id::text,
    true
  );

  PERFORM set_config('test.catalog_image_a', v_image_a::text, true);
  PERFORM set_config('test.catalog_image_b', v_image_b::text, true);
  PERFORM set_config(
    'test.catalog_second_image',
    v_second_image::text,
    true
  );

  INSERT INTO public.catalog_items (
    id,
    organization_id,
    template_version_id,
    name,
    slug
  )
  VALUES (
    v_item_id,
    current_setting('test.catalog_org_a')::uuid,
    current_setting('test.catalog_version_a')::uuid,
    'Content regression item',
    'content-regression-item'
  );

  PERFORM set_config(
    'test.catalog_sections_payload',
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'kind', 'text',
        'title', 'Description',
        'content', jsonb_build_object(
          'text', 'A detailed product description.'
        )
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'kind', 'list',
        'title', 'Features',
        'content', jsonb_build_object(
          'items', jsonb_build_array(
            'Battery powered',
            'Low maintenance'
          )
        )
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'kind', 'specifications',
        'title', 'Specifications',
        'content', jsonb_build_object(
          'field_keys', jsonb_build_array('width', 'power')
        )
      )
    )::text,
    true
  );

  -- These reserve image records only.
  -- Actual file uploads are tested separately through Storage.
  INSERT INTO public.catalog_item_images (
    id,
    organization_id,
    item_id,
    file_extension,
    alt_text,
    position
  )
  VALUES
    (
      v_image_a,
      current_setting('test.catalog_org_a')::uuid,
      v_item_id,
      'webp',
      'Original image description',
      0
    ),
    (
      v_image_b,
      current_setting('test.catalog_org_b')::uuid,
      current_setting('test.catalog_item_b')::uuid,
      'png',
      'Organization B image',
      0
    );
END;
$$;

-- =========================================================
-- Anonymous image access
-- =========================================================

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT * FROM public.catalog_item_images $$,
  '42501',
  NULL,
  'Anonymous visitors cannot read internal image records'
);

RESET ROLE;

-- =========================================================
-- Owner: section saving, rollback, and stale revisions
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_owner'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_owner'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT lives_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      (
        SELECT updated_at
        FROM public.catalog_items
        WHERE id = current_setting('test.catalog_content_item')::uuid
      ),
      current_setting('test.catalog_sections_payload')::jsonb
    )
  $$,
  'Owners can save all three content section types'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_sections
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  3::bigint,
  'Saving stores the complete section collection'
);

SELECT is(
  (
    SELECT array_agg(title ORDER BY position, id)
    FROM public.catalog_item_sections
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  ARRAY['Description', 'Features', 'Specifications']::text[],
  'Sections retain the submitted order'
);

SELECT is(
  (
    SELECT content
    FROM public.catalog_item_sections
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
      AND kind = 'specifications'
  ),
  '{"field_keys":["width","power"]}'::jsonb,
  'Specifications store field references rather than copied values'
);

-- Capture the complete collection to verify atomic rollback.
DO $$
BEGIN
  PERFORM set_config(
    'test.catalog_sections_before',
    (
      SELECT jsonb_agg(to_jsonb(section) ORDER BY position, id)::text
      FROM public.catalog_item_sections AS section
      WHERE item_id = current_setting('test.catalog_content_item')::uuid
    ),
    true
  );
END;
$$;

SELECT throws_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      (
        SELECT updated_at
        FROM public.catalog_items
        WHERE id = current_setting('test.catalog_content_item')::uuid
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'kind', 'text',
          'title', 'Replacement description',
          'content', jsonb_build_object('text', 'Valid replacement')
        ),
        jsonb_build_object(
          'id', gen_random_uuid(),
          'kind', 'list',
          'title', 'Invalid features',
          'content', '{"items":[123]}'::jsonb
        )
      )
    )
  $$,
  '23514',
  NULL,
  'One invalid section rejects the entire save'
);

SELECT is(
  (
    SELECT jsonb_agg(to_jsonb(section) ORDER BY position, id)
    FROM public.catalog_item_sections AS section
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  current_setting('test.catalog_sections_before')::jsonb,
  'Failed section saves preserve every previous section'
);

SELECT throws_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      (
        SELECT updated_at - interval '1 second'
        FROM public.catalog_items
        WHERE id = current_setting('test.catalog_content_item')::uuid
      ),
      '[]'::jsonb
    )
  $$,
  '40001',
  NULL,
  'Section saving rejects an outdated item revision'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_sections
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  3::bigint,
  'An outdated revision cannot erase saved content'
);

UPDATE public.catalog_items
SET
  attributes = '{"width":860,"power":"Battery"}'::jsonb,
  status = 'published'
WHERE id = current_setting('test.catalog_content_item')::uuid;

SELECT throws_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      (
        SELECT updated_at
        FROM public.catalog_items
        WHERE id = current_setting('test.catalog_content_item')::uuid
      ),
      '[]'::jsonb
    )
  $$,
  '23514',
  NULL,
  'The section-saving RPC rejects published items'
);

UPDATE public.catalog_items
SET status = 'draft'
WHERE id = current_setting('test.catalog_content_item')::uuid;

-- =========================================================
-- Owner: image reservations and primary selection
-- =========================================================

SELECT is(
  (
    SELECT object_path
    FROM public.catalog_item_images
    WHERE id = current_setting('test.catalog_image_a')::uuid
  ),
  current_setting('test.catalog_org_a') || '/' ||
  current_setting('test.catalog_content_item') || '/' ||
  current_setting('test.catalog_image_a') || '.webp',
  'Image paths include the organization, item, and image identifiers'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_images
    WHERE organization_id = current_setting('test.catalog_org_b')::uuid
  ),
  0::bigint,
  'Owners cannot read another organization image records'
);

SELECT lives_ok(
  $$
    INSERT INTO public.catalog_item_images (
      id,
      organization_id,
      item_id,
      file_extension,
      position
    )
    VALUES (
      current_setting('test.catalog_second_image')::uuid,
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      'jpg',
      1
    )
  $$,
  'Owners can reserve image uploads for their items'
);

SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_images (
      organization_id,
      item_id,
      file_extension
    )
    VALUES (
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_item_b')::uuid,
      'webp'
    )
  $$,
  '42501',
  NULL,
  'Image reservations cannot target another organization item'
);

SELECT throws_ok(
  $$
    UPDATE public.catalog_item_images
    SET file_extension = 'png'
    WHERE id = current_setting('test.catalog_image_a')::uuid
  $$,
  '23514',
  NULL,
  'Existing image storage identities cannot be changed'
);

SELECT lives_ok(
  $$
    SELECT public.set_catalog_primary_image(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      current_setting('test.catalog_second_image')::uuid
    )
  $$,
  'Owners can select the primary image'
);

SELECT is(
  (
    SELECT id
    FROM public.catalog_item_images
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
    ORDER BY position, created_at, id
    LIMIT 1
  ),
  current_setting('test.catalog_second_image')::uuid,
  'The selected primary image appears first'
);

-- Two images already exist; a nineteen-row insert exceeds twenty.
SELECT throws_ok(
  $$
    INSERT INTO public.catalog_item_images (
      organization_id,
      item_id,
      file_extension,
      position
    )
    SELECT
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      'webp',
      image_number + 1
    FROM generate_series(1, 19) AS image_number
  $$,
  '23514',
  NULL,
  'Image reservations enforce the twenty-image limit'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_images
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  2::bigint,
  'An oversized image reservation batch rolls back completely'
);

RESET ROLE;

-- =========================================================
-- Ordinary members: read access without management access
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_member'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_member'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_sections
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  3::bigint,
  'Members can read their organization content sections'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_images
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  2::bigint,
  'Members can read their organization image records'
);

SELECT throws_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      (
        SELECT updated_at
        FROM public.catalog_items
        WHERE id = current_setting('test.catalog_content_item')::uuid
      ),
      '[]'::jsonb
    )
  $$,
  '42501',
  NULL,
  'Members cannot save catalog sections'
);

SELECT throws_ok(
  $$
    SELECT public.set_catalog_primary_image(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      current_setting('test.catalog_image_a')::uuid
    )
  $$,
  '42501',
  NULL,
  'Members cannot change the primary image'
);

UPDATE public.catalog_item_images
SET alt_text = 'Unauthorized description'
WHERE id = current_setting('test.catalog_image_a')::uuid;

SELECT is(
  (
    SELECT alt_text
    FROM public.catalog_item_images
    WHERE id = current_setting('test.catalog_image_a')::uuid
  ),
  'Original image description',
  'Members cannot modify image descriptions'
);

DELETE FROM public.catalog_item_images
WHERE id = current_setting('test.catalog_image_a')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_images
    WHERE id = current_setting('test.catalog_image_a')::uuid
  ),
  1::bigint,
  'Members cannot delete image records'
);

RESET ROLE;

-- =========================================================
-- Other organization owner: no cross-tenant access
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_outsider'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_outsider'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_images
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  0::bigint,
  'Another organization owner cannot read these image records'
);

SELECT throws_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      now(),
      '[]'::jsonb
    )
  $$,
  '42501',
  NULL,
  'Another organization owner cannot overwrite these sections'
);

SELECT throws_ok(
  $$
    SELECT public.set_catalog_primary_image(
      current_setting('test.catalog_org_b')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      current_setting('test.catalog_image_a')::uuid
    )
  $$,
  'P0002',
  NULL,
  'Supplying an owned organization cannot grant access to another item'
);

RESET ROLE;

-- =========================================================
-- Workspace administrator: delegated content management
-- =========================================================

SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    current_setting('test.catalog_admin'),
    true
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', current_setting('test.catalog_admin'),
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT lives_ok(
  $$
    SELECT public.save_catalog_item_sections(
      current_setting('test.catalog_org_a')::uuid,
      current_setting('test.catalog_content_item')::uuid,
      (
        SELECT updated_at
        FROM public.catalog_items
        WHERE id = current_setting('test.catalog_content_item')::uuid
      ),
      '[]'::jsonb
    )
  $$,
  'Workspace admins can save an empty section collection'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.catalog_item_sections
    WHERE item_id = current_setting('test.catalog_content_item')::uuid
  ),
  0::bigint,
  'Saving an empty collection removes the previous sections'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;