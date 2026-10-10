-- =========================================================
-- Subscription resource limits
-- =========================================================

create function private.enforce_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resource_limit integer;
  resource_count integer;
  resource_name text;
  subscription_status text;
begin
  -- Serialize inserts within the same organization.
  perform 1
  from public.organizations
  where id = new.organization_id
  for update;

  -- Select the applicable plan limit.
  select
    s.status,
    case tg_table_name
      when 'organization_members' then p.max_members
      when 'customers' then p.max_customers
      when 'leads' then p.max_leads
      when 'estimates' then p.max_estimates
      when 'jobs' then p.max_jobs
    end
  into subscription_status, resource_limit
  from public.organization_subscriptions s
  join public.billing_plans p on p.id = s.plan_id
  where s.organization_id = new.organization_id;

  if not found then
    raise exception 'Organization subscription not found'
      using errcode = 'P0001';
  end if;

  if subscription_status not in ('active', 'trialing') then
    raise exception 'Organization subscription is not active'
      using errcode = 'P0001';
  end if;

  resource_name := tg_table_name;

  -- NULL means unlimited.
  if resource_limit is null then
    return new;
  end if;

  case tg_table_name
    when 'organization_members' then
      select count(*) into resource_count
      from public.organization_members
      where organization_id = new.organization_id
        and status = 'active';

    when 'customers' then
      select count(*) into resource_count
      from public.customers
      where organization_id = new.organization_id;

    when 'leads' then
      select count(*) into resource_count
      from public.leads
      where organization_id = new.organization_id;

    when 'estimates' then
      select count(*) into resource_count
      from public.estimates
      where organization_id = new.organization_id;

    when 'jobs' then
      select count(*) into resource_count
      from public.jobs
      where organization_id = new.organization_id;

    else
      raise exception 'Unsupported subscription resource';
  end case;

  if resource_count >= resource_limit then
    raise exception 'Subscription limit reached for %', resource_name
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- =========================================================
-- Resource triggers
-- =========================================================

create trigger enforce_lead_limit
before insert on public.leads
for each row
execute function private.enforce_subscription_limit();

create trigger enforce_customer_limit
before insert on public.customers
for each row
execute function private.enforce_subscription_limit();

create trigger enforce_estimate_limit
before insert on public.estimates
for each row
execute function private.enforce_subscription_limit();

create trigger enforce_job_limit
before insert on public.jobs
for each row
execute function private.enforce_subscription_limit();

create trigger enforce_member_limit
before insert on public.organization_members
for each row
execute function private.enforce_subscription_limit();