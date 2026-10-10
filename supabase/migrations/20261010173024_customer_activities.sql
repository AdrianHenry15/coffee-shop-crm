-- =========================================================
-- CUSTOMER ACTIVITIES
-- =========================================================

create table public.customer_activities (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null,

  customer_id uuid not null,

  created_by uuid not null
    references auth.users(id),

  type text not null
    check (type in ('note', 'call', 'email')),

  content text not null
    check (length(trim(content)) between 1 and 5000),

  created_at timestamptz not null default now(),

  constraint customer_activities_organization_fk
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint customer_activities_customer_fk
    foreign key (customer_id, organization_id)
    references public.customers(id, organization_id)
    on delete cascade
);

create index customer_activities_customer_idx
  on public.customer_activities (
    organization_id,
    customer_id,
    created_at desc
  );


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.customer_activities
enable row level security;

create policy "Members can view customer activities"
on public.customer_activities
for select
to authenticated
using (
  private.is_org_member(organization_id)
);

create policy "Members can create customer activities"
on public.customer_activities
for insert
to authenticated
with check (
  private.is_org_member(organization_id)
  and created_by = (select auth.uid())
);

create policy "Members can delete their own activities"
on public.customer_activities
for delete
to authenticated
using (
  private.is_org_member(organization_id)
  and created_by = (select auth.uid())
);

grant select, insert, delete
on public.customer_activities
to authenticated;