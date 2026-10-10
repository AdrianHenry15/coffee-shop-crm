
create or replace function public.get_organization_subscription_usage(
  org_uuid uuid
)
returns table (
  plan_id text,
  plan_name text,
  subscription_status text,
  resource text,
  used bigint,
  resource_limit integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Require an authenticated organization member.
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not private.is_org_member(org_uuid) then
    raise exception 'Organization access denied'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.name,
    s.status,
    resources.resource,
    resources.used,
    resources.resource_limit
  from public.organization_subscriptions s
  join public.billing_plans p
    on p.id = s.plan_id
  cross join lateral (
    values
      (
        'members'::text,
        (
          select count(*)
          from public.organization_members m
          where m.organization_id = org_uuid
            and m.status = 'active'
        ),
        p.max_members
      ),
      (
        'customers'::text,
        (
          select count(*)
          from public.customers c
          where c.organization_id = org_uuid
        ),
        p.max_customers
      ),
      (
        'leads'::text,
        (
          select count(*)
          from public.leads l
          where l.organization_id = org_uuid
        ),
        p.max_leads
      ),
      (
        'estimates'::text,
        (
          select count(*)
          from public.estimates e
          where e.organization_id = org_uuid
        ),
        p.max_estimates
      ),
      (
        'jobs'::text,
        (
          select count(*)
          from public.jobs j
          where j.organization_id = org_uuid
        ),
        p.max_jobs
      )
  ) as resources(resource, used, resource_limit)
  where s.organization_id = org_uuid;
end;
$$;

revoke all on function
  public.get_organization_subscription_usage(uuid)
from public, anon;

grant execute on function
  public.get_organization_subscription_usage(uuid)
to authenticated;
