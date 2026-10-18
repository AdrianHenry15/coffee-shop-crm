CREATE OR REPLACE FUNCTION private.require_available_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_deleted_at timestamptz;
BEGIN
  -- Existing records may still reference a deleted customer.
  -- Only new or changed customer associations are checked.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id
      AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Lock against concurrent customer deletion updates.
  SELECT c.deleted_at
  INTO v_deleted_at
  FROM public.customers AS c
  WHERE c.id = NEW.customer_id
    AND c.organization_id = NEW.organization_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or access denied'
      USING ERRCODE = '23503';
  END IF;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Restore the deleted customer before creating new linked records'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.require_available_customer()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER require_available_estimate_customer
BEFORE INSERT OR UPDATE OF customer_id, organization_id
ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION private.require_available_customer();

CREATE TRIGGER require_available_job_customer
BEFORE INSERT OR UPDATE OF customer_id, organization_id
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION private.require_available_customer();

CREATE TRIGGER require_available_activity_customer
BEFORE INSERT OR UPDATE OF customer_id, organization_id
ON public.customer_activities
FOR EACH ROW
EXECUTE FUNCTION private.require_available_customer();