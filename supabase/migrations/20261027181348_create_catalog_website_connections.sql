-- =========================================================
-- Website connections
--
-- Each connection belongs to exactly one organization.
-- Store only the SHA-256 hash of a randomly generated key.
-- The original key will be displayed once when created.
-- =========================================================

CREATE TABLE public.catalog_website_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  name text NOT NULL,

  api_key_hash text NOT NULL UNIQUE,

  enabled boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_website_connection_name_valid
    CHECK (length(btrim(name)) BETWEEN 1 AND 100),

  CONSTRAINT catalog_website_connection_key_hash_valid
    CHECK (api_key_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX catalog_website_connections_organization_idx
ON public.catalog_website_connections (
  organization_id,
  created_at DESC
);

-- =========================================================
-- Identity and timestamps
-- =========================================================

CREATE OR REPLACE FUNCTION private.guard_catalog_website_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    THEN
      RAISE EXCEPTION 'Website connection identity cannot change'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_catalog_website_connection()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_catalog_website_connection
BEFORE INSERT OR UPDATE
ON public.catalog_website_connections
FOR EACH ROW
EXECUTE FUNCTION private.guard_catalog_website_connection();

-- =========================================================
-- Management access
--
-- Workspace owners/admins manage connections.
-- Ordinary members and anonymous visitors have no access.
-- =========================================================

ALTER TABLE public.catalog_website_connections
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.catalog_website_connections
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.catalog_website_connections
TO authenticated;

CREATE POLICY "Catalog managers can manage website connections"
ON public.catalog_website_connections
FOR ALL
TO authenticated
USING (
  (SELECT private.can_manage_catalog(organization_id))
)
WITH CHECK (
  (SELECT private.can_manage_catalog(organization_id))
);

-- The server-side catalog endpoint will resolve API keys.
-- Service-role credentials remain exclusively on the CRM server.
GRANT SELECT
ON public.catalog_website_connections
TO service_role;