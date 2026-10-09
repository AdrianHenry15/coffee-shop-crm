
-- ============================================================
-- CoffeeShopCRM: Core Row Level Security
-- ============================================================

-- Enable RLS on all three application tables.

alter table public.profiles
  enable row level security;

alter table public.organizations
  enable row level security;

alter table public.organization_members
  enable row level security;


-- ============================================================
-- Private helper functions
-- ============================================================

create schema if not exists private;

-- Prevent API roles from creating objects in this schema.
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Does the current user have an active membership
-- in the specified organization?

create or replace function private.is_org_member(
  org_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

revoke all on function private.is_org_member(uuid)
  from public;

grant execute on function private.is_org_member(uuid)
  to authenticated;


-- ============================================================
-- Profiles
-- ============================================================

-- Users can read their own profile.

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);

-- Users can create only their own profile.

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
);

-- Users can update only their own profile.

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);


-- ============================================================
-- Organizations
-- ============================================================

-- Only active members can read their organization.

create policy "Members can read organizations"
on public.organizations
for select
to authenticated
using (
  (select private.is_org_member(id))
);

-- Organization creation will use a trusted server-side
-- onboarding operation that also creates the owner membership.

-- Only owners can update organization details.

create policy "Owners can update organizations"
on public.organizations
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
  )
);


-- ============================================================
-- Organization Members
-- ============================================================

-- Members can view the membership roster
-- of organizations they belong to.

create policy "Members can read organization members"
on public.organization_members
for select
to authenticated
using (
  (select private.is_org_member(organization_id))
);

-- Membership creation, role changes, and removal
-- will go through trusted server-side operations.
-- No direct INSERT, UPDATE, or DELETE policies yet.
