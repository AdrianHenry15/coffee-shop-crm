-- Allow authenticated users to view profiles of people
-- who share an active organization with them.

create or replace function private.shares_organization(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
      and mine.status = 'active'
      and theirs.status = 'active'
  );
$$;

revoke all on function private.shares_organization(uuid)
  from public;

grant execute on function private.shares_organization(uuid)
  to authenticated;

create policy "Members can read shared organization profiles"
on public.profiles
for select
to authenticated
using (
  (select private.shares_organization(id))
);