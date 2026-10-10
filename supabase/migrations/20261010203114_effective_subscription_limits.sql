create or replace function private.get_effective_subscription_limit(
  org_uuid uuid,
  resource_name text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_plan text;
  benefit_level text;
  base_limit integer;
begin
  -- Only recognized resources are supported.
  if resource_name not in (
    'members',
    'customers',
    'leads',
    'estimates',
    'jobs'
  ) then
    raise exception 'Unsupported subscription resource'
      using errcode = '22023';
  end if;

  -- Get the organization's subscription plan and standard limit.
  select
    p.id,
    case resource_name
      when 'members' then p.max_members
      when 'customers' then p.max_customers
      when 'leads' then p.max_leads
      when 'estimates' then p.max_estimates
      when 'jobs' then p.max_jobs
    end
  into current_plan, base_limit
  from public.organization_subscriptions s
  join public.billing_plans p
    on p.id = s.plan_id
  where s.organization_id = org_uuid;

  if not found then
    raise exception 'Organization subscription not found'
      using errcode = 'P0001';
  end if;

  -- Resolve permanent Partner or active Partner+ eligibility.
  benefit_level :=
    private.get_organization_benefit_level(org_uuid);

  -- Standard organizations retain their existing plan limits.
  if benefit_level = 'standard' then
    return base_limit;
  end if;

  -- Partner benefits by subscription plan.
  return case current_plan

    when 'free' then
      case benefit_level
        when 'partner' then
          case resource_name
            when 'members' then 3
            when 'customers' then 250
            when 'leads' then 250
            when 'estimates' then 100
            when 'jobs' then 100
          end

        when 'partner_plus' then
          case resource_name
            when 'members' then 5
            when 'customers' then 500
            when 'leads' then 500
            when 'estimates' then 250
            when 'jobs' then 250
          end
      end

    when 'starter' then
      case benefit_level
        when 'partner' then
          case resource_name
            when 'members' then 10
            when 'customers' then 2500
            when 'leads' then 1500
            else null
          end

        when 'partner_plus' then
          case resource_name
            when 'members' then 15
            when 'customers' then 5000
            when 'leads' then 3000
            else null
          end
      end

    when 'pro' then
      case resource_name
        when 'members' then
          case benefit_level
            when 'partner' then 25
            when 'partner_plus' then 40
          end
        else null
      end

    else base_limit
  end;
end;
$$;

-- This is an internal database helper.
-- Clients must not execute it directly.
revoke all on function private.get_effective_subscription_limit(uuid, text)
from public, anon, authenticated;