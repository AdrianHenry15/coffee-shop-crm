
create table public.estimates (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  customer_id uuid not null,

  status text not null default 'draft'
    check (status in (
      'draft',
      'sent',
      'accepted',
      'declined'
    )),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint estimates_id_organization_unique
    unique (id, organization_id)
);

create index estimates_organization_id_idx
  on public.estimates(organization_id);

create index estimates_customer_id_idx
  on public.estimates(customer_id);

create index estimates_organization_status_idx
  on public.estimates(organization_id, status);


alter table public.customers
add constraint customers_id_organization_unique
unique (id, organization_id);

alter table public.estimates
add constraint estimates_customer_same_organization
foreign key (customer_id, organization_id)
references public.customers(id, organization_id)
on delete restrict;


create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,

  estimate_id uuid not null,

  position integer not null default 0
  check (position >= 0),

  description text not null,


  quantity integer not null default 1
    check (quantity > 0),

  unit_price_cents bigint not null default 0
    check (unit_price_cents >= 0),

  created_at timestamptz not null default now(),

  constraint estimate_items_description_not_blank
    check (length(trim(description)) > 0),

  constraint estimate_items_estimate_same_organization
    foreign key (estimate_id, organization_id)
    references public.estimates(id, organization_id)
    on delete cascade
);

create index estimate_items_estimate_id_idx
  on public.estimate_items(estimate_id);

create index estimate_items_organization_id_idx
  on public.estimate_items(organization_id);


create function public.update_estimate_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_estimate_timestamp
before update on public.estimates
for each row
execute function public.update_estimate_timestamp();

create function public.prevent_estimate_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Estimate organization cannot be changed'
      using errcode = '23514';
  end if;

  if new.customer_id is distinct from old.customer_id then
    raise exception 'Estimate customer cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_estimate_organization_change
before update on public.estimates
for each row
execute function public.prevent_estimate_organization_change();

create function public.prevent_estimate_item_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Estimate item organization cannot be changed'
      using errcode = '23514';
  end if;

  if new.estimate_id is distinct from old.estimate_id then
    raise exception 'Estimate item parent cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_estimate_item_organization_change
before update on public.estimate_items
for each row
execute function public.prevent_estimate_item_organization_change();


alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;

-- Estimates

create policy "Members can view estimates"
on public.estimates
for select
to authenticated
using (private.is_org_member(organization_id));

create policy "Members can create estimates"
on public.estimates
for insert
to authenticated
with check (private.is_org_member(organization_id));

create policy "Members can update estimates"
on public.estimates
for update
to authenticated
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id));

create policy "Members can delete estimates"
on public.estimates
for delete
to authenticated
using (private.is_org_member(organization_id));

-- Estimate Items

create policy "Members can view estimate items"
on public.estimate_items
for select
to authenticated
using (private.is_org_member(organization_id));

create policy "Members can create estimate items"
on public.estimate_items
for insert
to authenticated
with check (private.is_org_member(organization_id));

create policy "Members can update estimate items"
on public.estimate_items
for update
to authenticated
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id));

create policy "Members can delete estimate items"
on public.estimate_items
for delete
to authenticated
using (private.is_org_member(organization_id));
