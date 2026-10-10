create table public.organization_benefits (
  organization_id uuid primary key
    references public.organizations(id)
    on delete cascade,

  partner_granted_at timestamptz,

  maintenance_starts_at timestamptz,
  maintenance_ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maintenance_dates_valid check (
    (
      maintenance_starts_at is null
      and maintenance_ends_at is null
    )
    or (
      maintenance_starts_at is not null
      and maintenance_ends_at is not null
      and maintenance_ends_at > maintenance_starts_at
    )
  ),

  constraint maintenance_requires_partner check (
    maintenance_starts_at is null
    or partner_granted_at is not null
  )
);

alter table public.organization_benefits
  enable row level security;

create policy "Organization members can view benefits"
on public.organization_benefits
for select
to authenticated
using (
  private.is_org_member(organization_id)
);

revoke all on public.organization_benefits
from anon, authenticated;

grant select on public.organization_benefits
to authenticated;