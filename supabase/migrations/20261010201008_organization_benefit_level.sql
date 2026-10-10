create or replace function private.get_organization_benefit_level(
  org_uuid uuid
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when b.partner_granted_at is not null
      and b.maintenance_starts_at <= now()
      and b.maintenance_ends_at > now()
      then 'partner_plus'

    when b.partner_granted_at is not null
      then 'partner'

    else 'standard'
  end
  from (select 1) as fallback
  left join public.organization_benefits b
    on b.organization_id = org_uuid;
$$;

revoke all on function private.get_organization_benefit_level(uuid)
from public, anon, authenticated;