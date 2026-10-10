create or replace function private.enforce_subscription_limit()
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
  perform 1
  from public.organizations
  where id = new.organization_id
  for update;

  select s.status
  into subscription_status
  from public.organization_subscriptions s
  where s.organization_id = new.organization_id;

  if not found then
    raise exception 'Organization subscription not found'
      using errcode = 'P0001';
  end if;

  if subscription_status not in ('active', 'trialing') then
    raise exception 'Organization subscription is not active'
      using errcode = 'P0001';
  end if;

  resource_name := case tg_table_name
    when 'organization_members' then 'members'
    when 'customers' then 'customers'
    when 'leads' then 'leads'
    when 'estimates' then 'estimates'
    when 'jobs' then 'jobs'
    else null
  end;

  if resource_name is null then
    raise exception 'Unsupported subscription resource'
      using errcode = '22023';
  end if;

  resource_limit := private.get_effective_subscription_limit(
    new.organization_id,
    resource_name
  );

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
  end case;

  if resource_count >= resource_limit then
    raise exception 'Subscription limit reached for %', tg_table_name
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;