-- =========================================================
-- Catalog items
-- Product/service type comes from the selected template.
-- =========================================================

CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  template_version_id uuid NOT NULL,

  name text NOT NULL,
  slug text NOT NULL,
  summary text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,

  price_mode text NOT NULL DEFAULT 'quote'
    CHECK (price_mode IN ('quote', 'fixed', 'starting_at')),

  price_cents bigint,
  currency text NOT NULL DEFAULT 'USD',

  published_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_item_template_same_organization
    FOREIGN KEY (template_version_id, organization_id)
    REFERENCES public.catalog_template_versions (id, organization_id)
    ON DELETE RESTRICT,

  CONSTRAINT catalog_items_id_organization_unique
    UNIQUE (id, organization_id),

  CONSTRAINT catalog_item_slug_unique
    UNIQUE (organization_id, slug),

  CONSTRAINT catalog_item_name_valid
    CHECK (length(btrim(name)) BETWEEN 1 AND 200),

  CONSTRAINT catalog_item_slug_valid
    CHECK (
      length(slug) BETWEEN 1 AND 120
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),

  CONSTRAINT catalog_item_summary_valid
    CHECK (summary IS NULL OR length(summary) <= 500),

  CONSTRAINT catalog_item_attributes_valid
    CHECK (
      jsonb_typeof(attributes) = 'object'
      AND octet_length(attributes::text) <= 131072
    ),

  CONSTRAINT catalog_item_currency_valid
    CHECK (currency ~ '^[A-Z]{3}$'),

  CONSTRAINT catalog_item_price_valid
    CHECK (
      (
        price_mode = 'quote'
        AND price_cents IS NULL
      )
      OR
      (
        price_mode IN ('fixed', 'starting_at')
        AND price_cents IS NOT NULL
        AND price_cents BETWEEN 0 AND 9007199254740991
      )
    )
);

CREATE INDEX catalog_items_organization_status_idx
ON public.catalog_items (organization_id, status, created_at DESC);

CREATE INDEX catalog_items_template_version_idx
ON public.catalog_items (template_version_id, organization_id);

-- =========================================================
-- Ordered content sections
--
-- text:
--   {"text": "Long description"}
--
-- list:
--   {"items": ["Feature one", "Feature two"]}
--
-- specifications:
--   {"field_keys": ["cutting_width", "power_source"]}
--
-- Specification sections reference attribute keys rather than
-- storing another copy of their values.
-- =========================================================

CREATE TABLE public.catalog_item_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL,
  item_id uuid NOT NULL,

  kind text NOT NULL
    CHECK (kind IN ('text', 'list', 'specifications')),

  title text NOT NULL,
  position integer NOT NULL DEFAULT 0
    CHECK (position >= 0),

  content jsonb NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_section_item_same_organization
    FOREIGN KEY (item_id, organization_id)
    REFERENCES public.catalog_items (id, organization_id)
    ON DELETE CASCADE,

  CONSTRAINT catalog_section_title_valid
    CHECK (length(btrim(title)) BETWEEN 1 AND 100),

  CONSTRAINT catalog_section_content_size
    CHECK (octet_length(content::text) <= 131072),

  CONSTRAINT catalog_section_content_valid
    CHECK (
      CASE kind
        WHEN 'text' THEN
          extensions.jsonb_matches_schema(
            '{
              "type": "object",
              "additionalProperties": false,
              "required": ["text"],
              "properties": {
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 20000
                }
              }
            }'::json,
            content
          )

        WHEN 'list' THEN
          extensions.jsonb_matches_schema(
            '{
              "type": "object",
              "additionalProperties": false,
              "required": ["items"],
              "properties": {
                "items": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 100,
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 1000
                  }
                }
              }
            }'::json,
            content
          )

        WHEN 'specifications' THEN
          extensions.jsonb_matches_schema(
            '{
              "type": "object",
              "additionalProperties": false,
              "required": ["field_keys"],
              "properties": {
                "field_keys": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 50,
                  "uniqueItems": true,
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": "^[a-z][a-z0-9_]*$"
                  }
                }
              }
            }'::json,
            content
          )

        ELSE false
      END
    )
);

CREATE INDEX catalog_sections_item_position_idx
ON public.catalog_item_sections (
  organization_id,
  item_id,
  position,
  id
);

-- =========================================================
-- Validate attributes against the template's field definitions.
-- Unknown fields are rejected.
-- Required fields are enforced when publishing.
-- =========================================================

CREATE OR REPLACE FUNCTION private.guard_catalog_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_fields jsonb;
  v_version_status text;
  v_template_archived_at timestamptz;

  v_field jsonb;
  v_property jsonb;
  v_properties jsonb := '{}'::jsonb;
  v_required jsonb := '[]'::jsonb;
  v_schema jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'New catalog items must start as drafts'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := now();
    NEW.published_at := NULL;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    THEN
      RAISE EXCEPTION 'Catalog item identity and organization cannot change'
        USING ERRCODE = '23514';
    END IF;

    -- A version migration needs a dedicated workflow that also
    -- checks the item's specification sections.
    IF NEW.template_version_id IS DISTINCT FROM OLD.template_version_id THEN
      RAISE EXCEPTION 'Catalog item template version cannot change here'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;
    NEW.published_at := OLD.published_at;

    IF NEW.status = 'published'
      AND OLD.status IS DISTINCT FROM 'published'
    THEN
      NEW.published_at := now();
    END IF;
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();

  IF NEW.attributes IS NULL
    OR jsonb_typeof(NEW.attributes) IS DISTINCT FROM 'object'
    OR octet_length(NEW.attributes::text) > 131072
  THEN
    RAISE EXCEPTION 'Invalid catalog attributes'
      USING ERRCODE = '23514';
  END IF;

  -- Keep the template stable while validating and saving.
  SELECT
    v.fields,
    v.status,
    t.archived_at
  INTO
    v_fields,
    v_version_status,
    v_template_archived_at
  FROM public.catalog_template_versions AS v
  JOIN public.catalog_templates AS t
    ON t.id = v.template_id
    AND t.organization_id = v.organization_id
  WHERE v.id = NEW.template_version_id
    AND v.organization_id = NEW.organization_id
  FOR SHARE OF v, t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog template not found or access denied'
      USING ERRCODE = '23503';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_version_status <> 'active'
      OR v_template_archived_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'Choose an active, available catalog template'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status = 'published'
    AND v_template_archived_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Items using an archived template cannot be published'
      USING ERRCODE = '23514';
  END IF;

  FOR v_field IN
    SELECT value
    FROM jsonb_array_elements(v_fields)
  LOOP
    CASE v_field ->> 'type'
      WHEN 'text' THEN
        v_property := jsonb_build_object(
          'type', 'string',
          'minLength', 1,
          'maxLength', 500
        );

      WHEN 'multiline' THEN
        v_property := jsonb_build_object(
          'type', 'string',
          'minLength', 1,
          'maxLength', 5000
        );

      WHEN 'number' THEN
        v_property := jsonb_build_object(
          'type', 'number'
        );

      WHEN 'boolean' THEN
        v_property := jsonb_build_object(
          'type', 'boolean'
        );

      WHEN 'select' THEN
        v_property := jsonb_build_object(
          'type', 'string',
          'enum', v_field -> 'options'
        );

      WHEN 'multiselect' THEN
        v_property := jsonb_build_object(
          'type', 'array',
          'minItems', 1,
          'maxItems', 100,
          'uniqueItems', true,
          'items', jsonb_build_object(
            'type', 'string',
            'enum', v_field -> 'options'
          )
        );

      ELSE
        RAISE EXCEPTION 'Unsupported catalog field type'
          USING ERRCODE = '23514';
    END CASE;

    v_properties := v_properties || jsonb_build_object(
      v_field ->> 'key',
      v_property
    );

    IF NEW.status = 'published'
      AND v_field -> 'required' = 'true'::jsonb
    THEN
      v_required := v_required || jsonb_build_array(
        v_field ->> 'key'
      );
    END IF;
  END LOOP;

  v_schema := jsonb_build_object(
    'type', 'object',
    'additionalProperties', false,
    'properties', v_properties,
    'required', v_required
  );

  IF NOT extensions.jsonb_matches_schema(
    v_schema::json,
    NEW.attributes
  ) THEN
    RAISE EXCEPTION
      'Catalog attributes do not match the template; check field values and required fields'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_item()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_catalog_item
BEFORE INSERT OR UPDATE
ON public.catalog_items
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_item();

-- =========================================================
-- Protect section identity and specification references.
-- =========================================================

CREATE OR REPLACE FUNCTION private.guard_catalog_item_section()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_fields jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.item_id IS DISTINCT FROM OLD.item_id
    THEN
      RAISE EXCEPTION 'Catalog section identity and parent cannot change'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;
  END IF;

  NEW.title := btrim(NEW.title);
  NEW.updated_at := now();

  SELECT v.fields
  INTO v_fields
  FROM public.catalog_items AS i
  JOIN public.catalog_template_versions AS v
    ON v.id = i.template_version_id
    AND v.organization_id = i.organization_id
  WHERE i.id = NEW.item_id
    AND i.organization_id = NEW.organization_id
  FOR SHARE OF i;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item not found or access denied'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.kind = 'specifications' THEN
    IF jsonb_typeof(NEW.content -> 'field_keys') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Specification sections require a field list'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        NEW.content -> 'field_keys'
      ) AS selected_field(field_key)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_fields) AS definition(field)
        WHERE definition.field ->> 'key' = selected_field.field_key
      )
    ) THEN
      RAISE EXCEPTION
        'Specification sections can only reference fields in the item template'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_item_section()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_catalog_item_section
BEFORE INSERT OR UPDATE
ON public.catalog_item_sections
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_item_section();

-- =========================================================
-- Permissions
-- Publication status does not grant public access.
-- Public website access will use a separate publishing layer.
-- =========================================================

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_sections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.catalog_items
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.catalog_item_sections
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.catalog_items, public.catalog_item_sections
TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'catalog_items',
    'catalog_item_sections'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "Members can read catalog content"
       ON public.%I
       FOR SELECT TO authenticated
       USING (
         (SELECT private.is_org_member(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY "Managers can create catalog content"
       ON public.%I
       FOR INSERT TO authenticated
       WITH CHECK (
         (SELECT private.can_manage_catalog(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY "Managers can update catalog content"
       ON public.%I
       FOR UPDATE TO authenticated
       USING (
         (SELECT private.can_manage_catalog(organization_id))
       )
       WITH CHECK (
         (SELECT private.can_manage_catalog(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY "Managers can delete catalog content"
       ON public.%I
       FOR DELETE TO authenticated
       USING (
         (SELECT private.can_manage_catalog(organization_id))
       )',
      v_table
    );
  END LOOP;
END;
$$;