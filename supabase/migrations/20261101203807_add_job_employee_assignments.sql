-- =========================================================
-- Employee assignments
-- Both the job and employee must belong to the same workspace.
-- =========================================================

CREATE TABLE public.job_employee_assignments (
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  job_id uuid NOT NULL,
  employee_id uuid NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT job_employee_assignments_pkey
    PRIMARY KEY (job_id, employee_id),

  CONSTRAINT job_employee_assignments_job_same_org_fkey
    FOREIGN KEY (job_id, organization_id)
    REFERENCES public.jobs (id, organization_id)
    ON DELETE CASCADE,

  CONSTRAINT job_employee_assignments_employee_same_org_fkey
    FOREIGN KEY (organization_id, employee_id)
    REFERENCES public.employees (organization_id, id)
    ON DELETE CASCADE
);

CREATE INDEX job_employee_assignments_org_employee_idx
ON public.job_employee_assignments (
  organization_id,
  employee_id,
  job_id
);

CREATE INDEX job_employee_assignments_org_job_idx
ON public.job_employee_assignments (
  organization_id,
  job_id
);


-- =========================================================
-- New assignments require an active employee.
-- Locking the employee coordinates assignment with deactivation.
-- Existing assignments survive employee deactivation.
-- =========================================================

CREATE FUNCTION private.guard_job_employee_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1
  FROM public.employees AS employee
  WHERE employee.id = NEW.employee_id
    AND employee.organization_id = NEW.organization_id
    AND employee.status = 'active'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Choose an active employee from this workspace'
      USING ERRCODE = '23514';
  END IF;

  NEW.created_at := clock_timestamp();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_job_employee_assignment()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_job_employee_assignment
BEFORE INSERT ON public.job_employee_assignments
FOR EACH ROW
EXECUTE FUNCTION private.guard_job_employee_assignment();


-- =========================================================
-- Assignment permissions
-- No UPDATE: change assignments through insert/delete.
-- =========================================================

ALTER TABLE public.job_employee_assignments
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.job_employee_assignments
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, DELETE
ON public.job_employee_assignments
TO authenticated;

CREATE POLICY job_employee_assignments_manager_select
ON public.job_employee_assignments
FOR SELECT TO authenticated
USING (
  (SELECT private.can_manage_employees(organization_id))
);

CREATE POLICY job_employee_assignments_manager_insert
ON public.job_employee_assignments
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.can_manage_employees(organization_id))
);

CREATE POLICY job_employee_assignments_manager_delete
ON public.job_employee_assignments
FOR DELETE TO authenticated
USING (
  (SELECT private.can_manage_employees(organization_id))
);