create or replace function public.get_platform_organization_details(
  org_uuid uuid
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_created_at timestamptz,
  plan_id text,
  plan_name text,
  subscription_status text,
  partner_granted_at timestamptz,
  maintenance_starts_at timestamptz,
  maintenance_ends_at timestamptz,
  benefit_level text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not private.is_platform_admin() then
    raise exception 'Platform administrator access required'
      using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.name,
    o.slug,
    o.created_at,
    s.plan_id,
    p.name,
    s.status,
    b.partner_granted_at,
    b.maintenance_starts_at,
    b.maintenance_ends_at,
    case
      when b.partner_granted_at is null then 'standard'
      when b.maintenance_starts_at <= now()
        and b.maintenance_ends_at > now() then 'partner_plus'
      else 'partner'
    end
  from public.organizations o
  left join public.organization_subscriptions s
    on s.organization_id = o.id
  left join public.billing_plans p
    on p.id = s.plan_id
  left join public.organization_benefits b
    on b.organization_id = o.id
  where o.id = org_uuid;
end;
$$;

revoke all on function public.get_platform_organization_details(uuid)
from public, anon, authenticated;

grant execute on function public.get_platform_organization_details(uuid)
to authenticated;