
create function public.convert_lead_to_customer(
  lead_uuid uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_lead public.leads%rowtype;
  customer_uuid uuid;
begin
  -- Require authentication.
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  -- Retrieve the lead using the caller's RLS permissions.
  select *
  into selected_lead
  from public.leads
  where id = lead_uuid
  for update;

  if not found then
    raise exception 'Lead not found or access denied'
      using errcode = 'P0002';
  end if;

  -- Explicitly verify active organization membership.
  if not private.is_org_member(selected_lead.organization_id) then
    raise exception 'Organization access denied'
      using errcode = '42501';
  end if;

  -- Do not convert lost leads.
  if selected_lead.status = 'lost' then
    raise exception 'Lost leads cannot be converted'
      using errcode = '23514';
  end if;

  -- Check for an existing customer.
  select id
  into customer_uuid
  from public.customers
  where organization_id = selected_lead.organization_id
    and lead_id = selected_lead.id;

  if found then
    raise exception 'Lead has already been converted'
      using errcode = '23505';
  end if;

  -- Create the customer using the lead's details.
  insert into public.customers (
    organization_id,
    lead_id,
    name,
    email,
    phone,
    notes
  )
  values (
    selected_lead.organization_id,
    selected_lead.id,
    selected_lead.name,
    selected_lead.email,
    selected_lead.phone,
    selected_lead.notes
  )
  returning id into customer_uuid;

  return customer_uuid;
end;
$$;

revoke all on function public.convert_lead_to_customer(uuid)
from public, anon;

grant execute on function public.convert_lead_to_customer(uuid)
to authenticated;
