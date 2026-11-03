-- =========================================================
-- Shared business-management permission
-- Platform administration does not grant workspace management.
-- =========================================================

CREATE FUNCTION private.can_manage_business_records(
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
    FROM public.organization_members AS member
    WHERE member.organization_id = p_organization_id
      AND member.user_id = (SELECT auth.uid())
      AND member.status = 'active'
      AND member.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION
  private.can_manage_business_records(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  private.can_manage_business_records(uuid)
TO authenticated, estimate_deleter;


-- =========================================================
-- Estimates, line items, and jobs
-- Restrictive policies add an AND requirement to existing access.
-- Existing SELECT policies remain unchanged.
-- =========================================================

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'estimates',
    'estimate_items',
    'jobs'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY v1_manager_insert
       ON public.%I
       AS RESTRICTIVE
       FOR INSERT
       TO authenticated, estimate_deleter
       WITH CHECK (
         (SELECT private.can_manage_business_records(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY v1_manager_update
       ON public.%I
       AS RESTRICTIVE
       FOR UPDATE
       TO authenticated, estimate_deleter
       USING (
         (SELECT private.can_manage_business_records(organization_id))
       )
       WITH CHECK (
         (SELECT private.can_manage_business_records(organization_id))
       )',
      v_table
    );

    EXECUTE format(
      'CREATE POLICY v1_manager_delete
       ON public.%I
       AS RESTRICTIVE
       FOR DELETE
       TO authenticated, estimate_deleter
       USING (
         (SELECT private.can_manage_business_records(organization_id))
       )',
      v_table
    );
  END LOOP;
END;
$$;


-- =========================================================
-- Contact deletion
-- Preserve the existing restrictive soft-delete requirements.
-- =========================================================

CREATE POLICY v1_manager_delete
ON public.leads
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  (SELECT private.can_manage_business_records(organization_id))
);

CREATE POLICY v1_manager_delete
ON public.customers
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  (SELECT private.can_manage_business_records(organization_id))
);


-- =========================================================
-- Contact archive/restore protection
-- Members can create/edit live contacts, but cannot:
--   * create already-archived contacts
--   * archive or restore contacts
--   * edit contacts that are already archived
--
-- Calls without a user identity remain available to trusted
-- database maintenance. Ordinary API access still requires RLS.
-- =========================================================

CREATE FUNCTION private.guard_contact_archive_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF private.can_manage_business_records(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only owners and admins can archive contacts'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF OLD.deleted_at IS NOT NULL
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION
        'Only owners and admins can archive, restore, or edit archived contacts'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  private.guard_contact_archive_permissions()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_lead_archive_permissions
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION private.guard_contact_archive_permissions();

CREATE TRIGGER guard_customer_archive_permissions
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION private.guard_contact_archive_permissions();

-- =========================================================
-- Status-only job operation
-- Members can move work forward:
--   scheduled -> in_progress -> completed
--
-- Owners/admins can choose any supported status.
-- Expected status prevents overwriting a concurrent status change.
-- =========================================================

CREATE FUNCTION public.set_job_progress(
  p_organization_id uuid,
  p_job_id uuid,
  p_status text,
  p_expected_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_current_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL
    OR p_status NOT IN (
      'scheduled', 'in_progress', 'completed', 'canceled'
    )
    OR p_expected_status IS NULL
    OR p_expected_status NOT IN (
      'scheduled', 'in_progress', 'completed', 'canceled'
    )
  THEN
    RAISE EXCEPTION 'Invalid job status'
      USING ERRCODE = '22023';
  END IF;

  -- Coordinates with owner-controlled membership changes,
  -- which lock the workspace FOR UPDATE.
  PERFORM 1
  FROM public.organizations
  WHERE id = p_organization_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT member.role
  INTO v_role
  FROM public.organization_members AS member
  WHERE member.organization_id = p_organization_id
    AND member.user_id = auth.uid()
    AND member.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT job.status
  INTO v_current_status
  FROM public.jobs AS job
  WHERE job.id = p_job_id
    AND job.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_current_status <> p_expected_status THEN
    RAISE EXCEPTION 'Job status changed. Reload before updating.'
      USING ERRCODE = '40001';
  END IF;

  IF v_role NOT IN ('owner', 'admin') THEN
    IF NOT (
      (v_current_status = 'scheduled' AND p_status = 'in_progress')
      OR
      (v_current_status = 'in_progress' AND p_status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Members can only start or complete work'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.jobs AS job
  SET status = p_status
  WHERE job.id = p_job_id
    AND job.organization_id = p_organization_id;

  -- Existing job triggers maintain completed_at and updated_at.
END;
$$;

REVOKE ALL ON FUNCTION
  public.set_job_progress(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.set_job_progress(uuid, uuid, text, text)
TO authenticated;