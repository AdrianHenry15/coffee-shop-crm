
create table public.leads (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,
  email text,
  phone text,

  status text not null default 'new'
    check (
      status in (
        'new',
        'contacted',
        'qualified',
        'lost'
      )
    ),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_name_not_blank
    check (length(trim(name)) > 0)
);

create index leads_organization_id_idx
  on public.leads(organization_id);

create index leads_organization_status_idx
  on public.leads(organization_id, status);

create index leads_organization_created_at_idx
  on public.leads(organization_id, created_at desc);


create or replace function public.update_lead_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_lead_timestamp
before update on public.leads
for each row
execute function public.update_lead_timestamp();


alter table public.leads enable row level security;

create policy "Members can view organization leads"
on public.leads
for select
to authenticated
using (
  private.is_org_member(organization_id)
);

create policy "Members can create organization leads"
on public.leads
for insert
to authenticated
with check (
  private.is_org_member(organization_id)
);

create policy "Members can update organization leads"
on public.leads
for update
to authenticated
using (
  private.is_org_member(organization_id)
)
with check (
  private.is_org_member(organization_id)
);

create policy "Members can delete organization leads"
on public.leads
for delete
to authenticated
using (
  private.is_org_member(organization_id)
);
