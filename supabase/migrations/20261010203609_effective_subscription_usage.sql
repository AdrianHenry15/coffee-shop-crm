-- ============================================================
-- Effective Subscription Usage
--
-- Uses subscription plan + TGS Partner benefits to report
-- the same resource limits enforced by PostgreSQL.
-- ============================================================


-- 1. Secure wrapper for retrieving effective limits.
-- Only authenticated organization members can access them.

create or replace function private.get_subscription_usage_limit(
  org_uuid uuid,
  resource_name text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Require authentication.
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  -- Require active organization membership.
  if not private.is_org_member(org_uuid) then
    raise exception 'Organization access denied'
      using errcode = '42501';
  end if;

  -- Retrieve the effective limit based on subscription
  -- plan and TGS Partner eligibility.
  return private.get_effective_subscription_limit(
    org_uuid,
    resource_name
  );
end;
$$;

-- Prevent anonymous and public execution.
revoke all on function private.get_subscription_usage_limit(uuid, text)
from public, anon, authenticated;

-- Allow authenticated users to call the wrapper.
-- The function enforces organization membership internally.
grant execute on function private.get_subscription_usage_limit(uuid, text)
to authenticated;


-- 2. Update the existing subscription usage RPC.
-- Preserve the return structure for existing frontend code.

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
  -- Require authentication.
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  -- Require organization membership.
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

      -- Active organization members.
      (
        'members'::text,
        (
          select count(*)
          from public.organization_members m
          where m.organization_id = org_uuid
            and m.status = 'active'
        ),
        private.get_subscription_usage_limit(
          org_uuid,
          'members'
        )
      ),

      -- Customers.
      (
        'customers'::text,
        (
          select count(*)
          from public.customers c
          where c.organization_id = org_uuid
        ),
        private.get_subscription_usage_limit(
          org_uuid,
          'customers'
        )
      ),

      -- Leads.
      (
        'leads'::text,
        (
          select count(*)
          from public.leads l
          where l.organization_id = org_uuid
        ),
        private.get_subscription_usage_limit(
          org_uuid,
          'leads'
        )
      ),

      -- Estimates.
      (
        'estimates'::text,
        (
          select count(*)
          from public.estimates e
          where e.organization_id = org_uuid
        ),
        private.get_subscription_usage_limit(
          org_uuid,
          'estimates'
        )
      ),

      -- Jobs.
      (
        'jobs'::text,
        (
          select count(*)
          from public.jobs j
          where j.organization_id = org_uuid
        ),
        private.get_subscription_usage_limit(
          org_uuid,
          'jobs'
        )
      )

  ) as resources(resource, used, resource_limit)

  where s.organization_id = org_uuid;
end;
$$;