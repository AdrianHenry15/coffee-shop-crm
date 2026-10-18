-- =========================================================
-- Catalog permissions
-- Active workspace owners and admins manage catalog content.
-- Active members can read it.
-- =========================================================

CREATE OR REPLACE FUNCTION private.can_manage_catalog(
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION private.can_manage_catalog(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.can_manage_catalog(uuid)
TO authenticated;

-- =========================================================
-- JSON validation
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pg_jsonschema
WITH SCHEMA extensions;

-- =========================================================
-- Templates
-- Examples: Battery mower, Replacement part, Cleaning service.
-- =========================================================

CREATE TABLE public.catalog_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  name text NOT NULL,
  description text,

  kind text NOT NULL
    CHECK (kind IN ('product', 'service')),

  archived_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_template_name_valid
    CHECK (length(btrim(name)) BETWEEN 1 AND 100),

  CONSTRAINT catalog_template_description_valid
    CHECK (
      description IS NULL
      OR length(description) <= 2000
    ),

  CONSTRAINT catalog_templates_id_organization_unique
    UNIQUE (id, organization_id)
);

CREATE INDEX catalog_templates_organization_idx
ON public.catalog_templates (organization_id, created_at DESC);

-- =========================================================
-- Template versions
--
-- Draft: editable.
-- Active: available for new catalog items; fields are frozen.
-- Retired: retained for existing items; fields remain frozen.
--
-- Field definitions describe the generated editing form.
-- =========================================================

CREATE TABLE public.catalog_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL,

  template_id uuid NOT NULL,

  version_number integer NOT NULL
    CHECK (version_number > 0),

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'retired')),

  fields jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_version_template_same_organization
    FOREIGN KEY (template_id, organization_id)
    REFERENCES public.catalog_templates (id, organization_id)
    ON DELETE CASCADE,

  CONSTRAINT catalog_template_version_number_unique
    UNIQUE (template_id, version_number),

  CONSTRAINT catalog_versions_id_organization_unique
    UNIQUE (id, organization_id),

  CONSTRAINT catalog_version_fields_size
    CHECK (octet_length(fields::text) <= 65536),

  CONSTRAINT catalog_version_fields_structure
    CHECK (
      extensions.jsonb_matches_schema(
        '{
          "type": "array",
          "maxItems": 50,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["key", "label", "type", "required"],
            "properties": {
              "key": {
                "type": "string",
                "minLength": 1,
                "maxLength": 64,
                "pattern": "^[a-z][a-z0-9_]*$"
              },
              "label": {
                "type": "string",
                "minLength": 1,
                "maxLength": 100
              },
              "type": {
                "type": "string",
                "enum": [
                  "text",
                  "multiline",
                  "number",
                  "boolean",
                  "select",
                  "multiselect"
                ]
              },
              "required": {
                "type": "boolean"
              },
              "help": {
                "type": "string",
                "maxLength": 500
              },
              "group": {
                "type": "string",
                "minLength": 1,
                "maxLength": 100
              },
              "unit": {
                "type": "string",
                "minLength": 1,
                "maxLength": 30
              },
              "options": {
                "type": "array",
                "minItems": 1,
                "maxItems": 100,
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 100
                }
              }
            }
          }
        }'::json,
        fields
      )
    )
);

CREATE INDEX catalog_versions_organization_idx
ON public.catalog_template_versions (organization_id, template_id);

-- Each template has at most one active version.
CREATE UNIQUE INDEX catalog_template_one_active_version
ON public.catalog_template_versions (template_id)
WHERE status = 'active';

-- =========================================================
-- Protect template identity and timestamps
-- =========================================================

CREATE OR REPLACE FUNCTION private.guard_catalog_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.kind IS DISTINCT FROM OLD.kind
    THEN
      RAISE EXCEPTION
        'Template identity, organization, and product/service type cannot change'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_template()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_catalog_template
BEFORE INSERT OR UPDATE
ON public.catalog_templates
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_template();

-- =========================================================
-- Validate field definitions and freeze activated versions
-- =========================================================

CREATE OR REPLACE FUNCTION private.guard_catalog_template_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_field jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'New template versions must start as drafts'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := now();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.template_id IS DISTINCT FROM OLD.template_id
      OR NEW.version_number IS DISTINCT FROM OLD.version_number
    THEN
      RAISE EXCEPTION 'Template version identity cannot change'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status IN ('active', 'retired')
      AND NEW.fields IS DISTINCT FROM OLD.fields
    THEN
      RAISE EXCEPTION
        'Activated template fields cannot change; create a new version'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'active'
      AND NEW.status NOT IN ('active', 'retired')
    THEN
      RAISE EXCEPTION 'An active version can only be retired'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'retired'
      AND NEW.status IS DISTINCT FROM 'retired'
    THEN
      RAISE EXCEPTION 'A retired version cannot be reactivated'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'draft'
      AND NEW.status = 'retired'
    THEN
      RAISE EXCEPTION 'Only activated versions can be retired'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;
  END IF;

  IF jsonb_typeof(NEW.fields) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Template fields must be an array'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.fields) AS f(value)
    GROUP BY f.value ->> 'key'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Template field keys must be unique'
      USING ERRCODE = '23514';
  END IF;

  FOR v_field IN
    SELECT value
    FROM jsonb_array_elements(NEW.fields)
  LOOP
    IF v_field ->> 'type' IN ('select', 'multiselect') THEN
      IF jsonb_typeof(v_field -> 'options') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Selection fields require an options list'
          USING ERRCODE = '23514';
      END IF;
    ELSIF v_field ? 'options' THEN
      RAISE EXCEPTION 'Only selection fields can define options'
        USING ERRCODE = '23514';
    END IF;

    IF v_field ? 'unit'
      AND v_field ->> 'type' IS DISTINCT FROM 'number'
    THEN
      RAISE EXCEPTION 'Only numeric fields can define a unit'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_template_version()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_catalog_template_version
BEFORE INSERT OR UPDATE
ON public.catalog_template_versions
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_template_version();

-- =========================================================
-- Table permissions and tenant isolation
-- =========================================================

ALTER TABLE public.catalog_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_template_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.catalog_templates
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.catalog_template_versions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.catalog_templates, public.catalog_template_versions
TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'catalog_templates',
    'catalog_template_versions'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "Members can read catalog templates"
       ON public.%I
       FOR SELECT TO authenticated
       USING (
         (SELECT private.is_org_member(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY "Managers can create catalog templates"
       ON public.%I
       FOR INSERT TO authenticated
       WITH CHECK (
         (SELECT private.can_manage_catalog(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY "Managers can update catalog templates"
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
  END LOOP;
END;
$$;

CREATE POLICY "Managers can delete catalog templates"
ON public.catalog_templates
FOR DELETE
TO authenticated
USING (
  (SELECT private.can_manage_catalog(organization_id))
);

CREATE POLICY "Managers can delete draft catalog versions"
ON public.catalog_template_versions
FOR DELETE
TO authenticated
USING (
  status = 'draft'
  AND (SELECT private.can_manage_catalog(organization_id))
);