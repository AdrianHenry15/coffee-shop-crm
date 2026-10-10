create or replace function public.get_platform_organizations(
  search_term text default '',
  page_number integer default 1,
  page_size integer default 20
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_created_at timestamptz,
  plan_id text,
  plan_name text,
  subscription_status text,
  benefit_level text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Authentication and platform authorization.
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not private.is_platform_admin() then
    raise exception 'Platform administrator access required'
      using errcode = '42501';
  end if;

  -- Prevent invalid pagination parameters.
  if page_number is null or page_number < 1 then
    raise exception 'Invalid page number'
      using errcode = '22023';
  end if;

  if page_size is null or page_size < 1 or page_size > 100 then
    raise exception 'Page size must be between 1 and 100'
      using errcode = '22023';
  end if;

  if (page_number::bigint - 1) * page_size::bigint > 2147483647 then
    raise exception 'Page offset is too large'
      using errcode = '22023';
  end if;

  return query
  with matching_organizations as (
    select
      o.id,
      o.name,
      o.slug,
      o.created_at,
      s.plan_id,
      p.name as billing_plan_name,
      s.status,
      case
        when b.partner_granted_at is null then 'standard'
        when b.maintenance_starts_at <= now()
          and b.maintenance_ends_at > now() then 'partner_plus'
        else 'partner'
      end as current_benefit_level
    from public.organizations o
    left join public.organization_subscriptions s
      on s.organization_id = o.id
    left join public.billing_plans p
      on p.id = s.plan_id
    left join public.organization_benefits b
      on b.organization_id = o.id
    where
      nullif(btrim(search_term), '') is null
      or o.name ilike '%' || btrim(search_term) || '%'
      or o.slug ilike '%' || btrim(search_term) || '%'
  )
  select
    m.id,
    m.name,
    m.slug,
    m.created_at,
    m.plan_id,
    m.billing_plan_name,
    m.status,
    m.current_benefit_level,
    count(*) over () as total_count
  from matching_organizations m
  order by m.created_at desc, m.id
  limit page_size
  offset (page_number::bigint - 1) * page_size::bigint;
end;
$$;

-- Restrict RPC execution to authenticated users.
-- The function itself checks platform authorization.
revoke all on function public.get_platform_organizations(
  text, integer, integer
) from public, anon, authenticated;

grant execute on function public.get_platform_organizations(
  text, integer, integer
) to authenticated;