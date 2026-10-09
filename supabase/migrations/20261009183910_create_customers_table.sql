alter table public.leads
add constraint leads_id_organization_unique
unique (id, organization_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  lead_id uuid
    references public.leads(id)
    on delete set null,

  name text not null,
  email text,
  phone text,

  status text not null default 'active'
    check (status in ('active', 'inactive')),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_name_not_blank
    check (length(trim(name)) > 0),

  constraint customers_organization_lead_unique
    unique (organization_id, lead_id)
);

create index customers_organization_id_idx
  on public.customers(organization_id);

create index customers_organization_status_idx
  on public.customers(organization_id, status);

create index customers_organization_created_at_idx
  on public.customers(organization_id, created_at desc);


alter table public.customers
add constraint customers_lead_same_organization
foreign key (lead_id, organization_id)
references public.leads(id, organization_id)
on delete set null (lead_id);


create function public.update_customer_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_customer_timestamp
before update on public.customers
for each row
execute function public.update_customer_timestamp();


create function public.prevent_customer_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Customer organization cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_customer_organization_change
before update on public.customers
for each row
execute function public.prevent_customer_organization_change();


alter table public.customers enable row level security;

create policy "Members can view organization customers"
on public.customers
for select
to authenticated
using (
  private.is_org_member(organization_id)
);

create policy "Members can create organization customers"
on public.customers
for insert
to authenticated
with check (
  private.is_org_member(organization_id)
);

create policy "Members can update organization customers"
on public.customers
for update
to authenticated
using (
  private.is_org_member(organization_id)
)
with check (
  private.is_org_member(organization_id)
);

create policy "Members can delete organization customers"
on public.customers
for delete
to authenticated
using (
  private.is_org_member(organization_id)
);
