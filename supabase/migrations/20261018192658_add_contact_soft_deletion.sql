-- =========================================================
-- Soft deletion
-- NULL means the contact is not deleted.
-- =========================================================

ALTER TABLE public.leads
  ADD COLUMN deleted_at timestamptz;

ALTER TABLE public.customers
  ADD COLUMN deleted_at timestamptz;

CREATE INDEX leads_recently_deleted_idx
  ON public.leads (organization_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX customers_recently_deleted_idx
  ON public.customers (organization_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- =========================================================
-- Permanent deletion requires prior soft deletion.
--
-- Restrictive policies work alongside the existing membership
-- policies; they do not grant additional deletion permissions.
-- =========================================================

CREATE POLICY "Permanent lead deletion requires soft deletion"
ON public.leads
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  deleted_at IS NOT NULL
);

CREATE POLICY "Permanent customer deletion requires soft deletion"
ON public.customers
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  deleted_at IS NOT NULL
);

-- =========================================================
-- Prevent conversion of a soft-deleted lead.
-- Preserve the existing conversion behavior and RLS checks.
-- =========================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_customer(
  lead_uuid uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  selected_lead public.leads%ROWTYPE;
  customer_uuid uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO selected_lead
  FROM public.leads
  WHERE id = lead_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found or access denied'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT private.is_org_member(selected_lead.organization_id) THEN
    RAISE EXCEPTION 'Organization access denied'
      USING ERRCODE = '42501';
  END IF;

  IF selected_lead.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restore this lead before converting it'
      USING ERRCODE = '23514';
  END IF;

  IF selected_lead.status = 'lost' THEN
    RAISE EXCEPTION 'Lost leads cannot be converted'
      USING ERRCODE = '23514';
  END IF;

  SELECT id
  INTO customer_uuid
  FROM public.customers
  WHERE organization_id = selected_lead.organization_id
    AND lead_id = selected_lead.id;

  IF FOUND THEN
    RAISE EXCEPTION 'Lead has already been converted'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.customers (
    organization_id,
    lead_id,
    name,
    email,
    phone,
    notes
  )
  VALUES (
    selected_lead.organization_id,
    selected_lead.id,
    selected_lead.name,
    selected_lead.email,
    selected_lead.phone,
    selected_lead.notes
  )
  RETURNING id INTO customer_uuid;

  RETURN customer_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_customer(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.convert_lead_to_customer(uuid)
TO authenticated;