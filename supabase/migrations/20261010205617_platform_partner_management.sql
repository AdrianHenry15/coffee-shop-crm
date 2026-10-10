-- =========================================================
-- TGS Platform Partner Management
-- =========================================================

-- 1. Grant permanent Partner benefits.

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

  -- Serialize benefit changes for this organization.
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

  -- Preserve an existing grant and maintenance agreement.
  insert into public.organization_benefits (
    organization_id,
    partner_granted_at
  )
  values (
    org_uuid,
    now()
  )
  on conflict (organization_id)
  do update
    set partner_granted_at =
      coalesce(
        public.organization_benefits.partner_granted_at,
        excluded.partner_granted_at
      ),
      updated_at = now();

  select to_jsonb(b)
  into updated_benefits
  from public.organization_benefits b
  where b.organization_id = org_uuid;

  if previous_benefits is distinct from updated_benefits then
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
  end if;
end;
$$;


-- 2. Revoke permanent Partner benefits.

create or replace function public.revoke_organization_partner(
  org_uuid uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_benefits jsonb;
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

  -- Removing the row also removes Partner+ maintenance.
  delete from public.organization_benefits
  where organization_id = org_uuid;

  if previous_benefits is not null then
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
      'partner_revoked',
      previous_benefits,
      null
    );
  end if;
end;
$$;


-- 3. Manage Partner+ maintenance.

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

  select to_jsonb(b)
  into previous_benefits
  from public.organization_benefits b
  where b.organization_id = org_uuid;

  if previous_benefits is null then
    raise exception 'Organization must have Partner benefits first'
      using errcode = '22023';
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

  if previous_benefits is distinct from updated_benefits then
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
  end if;
end;
$$;


-- =========================================================
-- Execution permissions
-- =========================================================

revoke all on function public.grant_organization_partner(uuid)
from public, anon, authenticated;

revoke all on function public.revoke_organization_partner(uuid)
from public, anon, authenticated;

revoke all on function public.set_organization_maintenance(
  uuid,
  timestamptz,
  timestamptz
)
from public, anon, authenticated;

grant execute on function public.grant_organization_partner(uuid)
to authenticated;

grant execute on function public.revoke_organization_partner(uuid)
to authenticated;

grant execute on function public.set_organization_maintenance(
  uuid,
  timestamptz,
  timestamptz
)
to authenticated;