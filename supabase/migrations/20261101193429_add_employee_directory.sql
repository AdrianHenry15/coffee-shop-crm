-- =========================================================
-- Employee-directory authorization
-- Managing staff records does not grant account-management rights.
-- =========================================================

CREATE FUNCTION private.can_manage_employees(
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

REVOKE ALL ON FUNCTION private.can_manage_employees(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.can_manage_employees(uuid)
TO authenticated;


-- =========================================================
-- Employee directory
-- Optional membership link must belong to the same organization.
-- Removing a membership preserves its employee record.
-- =========================================================

ALTER TABLE public.organization_members
ADD CONSTRAINT organization_members_org_id_id_unique
UNIQUE (organization_id, id);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  name text NOT NULL,
  email text,
  phone text,
  job_title text,

  status text NOT NULL DEFAULT 'active',
  membership_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT employees_name_check
    CHECK (
      name = btrim(name)
      AND length(name) BETWEEN 1 AND 120
    ),

  CONSTRAINT employees_email_check
    CHECK (
      email IS NULL
      OR (
        email = lower(btrim(email))
        AND length(email) BETWEEN 3 AND 254
        AND email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
      )
    ),

  CONSTRAINT employees_phone_check
    CHECK (
      phone IS NULL
      OR (
        phone = btrim(phone)
        AND length(phone) BETWEEN 1 AND 50
      )
    ),

  CONSTRAINT employees_job_title_check
    CHECK (
      job_title IS NULL
      OR (
        job_title = btrim(job_title)
        AND length(job_title) BETWEEN 1 AND 120
      )
    ),

  CONSTRAINT employees_status_check
    CHECK (status IN ('active', 'inactive')),

  CONSTRAINT employees_org_id_id_unique
    UNIQUE (organization_id, id),

  CONSTRAINT employees_org_membership_unique
    UNIQUE (organization_id, membership_id),

  CONSTRAINT employees_membership_same_org_fkey
    FOREIGN KEY (organization_id, membership_id)
    REFERENCES public.organization_members (organization_id, id)
    ON DELETE SET NULL (membership_id)
);

CREATE INDEX employees_org_status_name_idx
ON public.employees (organization_id, status, name, id);


-- =========================================================
-- Integrity guards
-- Existing suspended links can remain for staff history.
-- New links must point to an active membership.
-- =========================================================

CREATE FUNCTION private.guard_employee_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check_membership boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_check_membership := NEW.membership_id IS NOT NULL;
    NEW.created_at := clock_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    THEN
      RAISE EXCEPTION 'Employee identity and workspace cannot be changed'
        USING ERRCODE = '23514';
    END IF;

    NEW.created_at := OLD.created_at;

    v_check_membership :=
      NEW.membership_id IS NOT NULL
      AND NEW.membership_id IS DISTINCT FROM OLD.membership_id;
  END IF;

  IF v_check_membership THEN
    PERFORM 1
    FROM public.organization_members AS member
    WHERE member.id = NEW.membership_id
      AND member.organization_id = NEW.organization_id
      AND member.status = 'active'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Employee links require an active membership in the same workspace'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := clock_timestamp();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_employee_record()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_employee_record
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION private.guard_employee_record();


-- =========================================================
-- Access policies
-- Employee contact details are initially restricted to managers.
-- Ordinary members receive no directory access from this migration.
-- =========================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.employees
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.employees
TO authenticated;

CREATE POLICY employees_manager_select
ON public.employees
FOR SELECT TO authenticated
USING (
  (SELECT private.can_manage_employees(organization_id))
);

CREATE POLICY employees_manager_insert
ON public.employees
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.can_manage_employees(organization_id))
);

CREATE POLICY employees_manager_update
ON public.employees
FOR UPDATE TO authenticated
USING (
  (SELECT private.can_manage_employees(organization_id))
)
WITH CHECK (
  (SELECT private.can_manage_employees(organization_id))
);

-- No browser DELETE permission.
-- Mark departed employees inactive to preserve their records.