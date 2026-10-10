-- =========================================================
-- Idempotent Partner grant
-- =========================================================

create or replace function public.grant_organization_partner(
  org_uuid uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_benefits jsonb;
  updated_benefits jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not private.is_platform_admin() then
    raise exception 'Platform administrator access required'
      using errcode = '42501';
  end if;

  perform 1
  from public.organizations
  where id = org_uuid
  for update;

  if not found then
    raise exception 'Organization not found'
      using errcode = 'P0002';
  end if;

  select to_jsonb(b)
  into previous_benefits
  from public.organization_benefits b
  where b.organization_id = org_uuid;

  -- An existing Partner grant is already the desired state.
  if previous_benefits is not null then
    return;
  end if;

  insert into public.organization_benefits (
    organization_id,
    partner_granted_at
  )
  values (
    org_uuid,
    now()
  );

  select to_jsonb(b)
  into updated_benefits
  from public.organization_benefits b
  where b.organization_id = org_uuid;

  insert into public.platform_admin_audit_logs (
    actor_user_id,
    organization_id,
    action,
    previous_values,
    new_values
  )
  values (
    auth.uid(),
    org_uuid,
    'partner_granted',
    previous_benefits,
    updated_benefits
  );
end;
$$;


-- =========================================================
-- Idempotent maintenance updates
-- =========================================================

create or replace function public.set_organization_maintenance(
  org_uuid uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_benefits jsonb;
  updated_benefits jsonb;
  existing_starts_at timestamptz;
  existing_ends_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not private.is_platform_admin() then
    raise exception 'Platform administrator access required'
      using errcode = '42501';
  end if;

  if (starts_at is null) <> (ends_at is null) then
    raise exception 'Both maintenance dates are required'
      using errcode = '22023';
  end if;

  if starts_at is not null and ends_at <= starts_at then
    raise exception 'Maintenance end must be after start'
      using errcode = '22023';
  end if;

  perform 1
  from public.organizations
  where id = org_uuid
  for update;

  if not found then
    raise exception 'Organization not found'
      using errcode = 'P0002';
  end if;

  select
    to_jsonb(b),
    b.maintenance_starts_at,
    b.maintenance_ends_at
  into
    previous_benefits,
    existing_starts_at,
    existing_ends_at
  from public.organization_benefits b
  where b.organization_id = org_uuid;

  if previous_benefits is null then
    raise exception 'Organization must have Partner benefits first'
      using errcode = '22023';
  end if;

  -- NULL-safe comparison prevents unnecessary updates.
  if existing_starts_at is not distinct from starts_at
     and existing_ends_at is not distinct from ends_at then
    return;
  end if;

  update public.organization_benefits
  set
    maintenance_starts_at = starts_at,
    maintenance_ends_at = ends_at,
    updated_at = now()
  where organization_id = org_uuid;

  select to_jsonb(b)
  into updated_benefits
  from public.organization_benefits b
  where b.organization_id = org_uuid;

  insert into public.platform_admin_audit_logs (
    actor_user_id,
    organization_id,
    action,
    previous_values,
    new_values
  )
  values (
    auth.uid(),
    org_uuid,
    'maintenance_updated',
    previous_benefits,
    updated_benefits
  );
end;
$$;