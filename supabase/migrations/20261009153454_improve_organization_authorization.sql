
-- ============================================================
-- CoffeeShopCRM: Organization authorization
-- ============================================================

-- Check whether the authenticated user is an active owner.
create or replace function private.is_org_owner(org_id uuid)
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
      and m.role = 'owner'
      and m.status = 'active'
  );
$$;

revoke all on function private.is_org_owner(uuid) from public;

grant execute on function private.is_org_owner(uuid)
  to authenticated;


-- Replace the original UPDATE policy.
drop policy if exists "Owners can update organizations"
on public.organizations;

create policy "Owners can update organizations"
on public.organizations
for update
to authenticated
using (
  (select private.is_org_owner(id))
)
with check (
  (select private.is_org_owner(id))
);
