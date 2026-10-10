-- Helper runs as postgres, which already has access to auth.uid().
create or replace function private.estimate_deletion_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

revoke all on function private.estimate_deletion_user_id()
from public, anon, authenticated;

grant execute on function private.estimate_deletion_user_id()
to estimate_deleter;

-- Temporarily assume the function owner's role.
set role estimate_deleter;

-- Update the deletion RPC to use the helper.
create or replace function public.delete_estimate(
  p_organization_id uuid,
  p_estimate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.estimate_deletion_user_id() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_org_member(p_organization_id) then
    raise exception 'Organization access denied';
  end if;

  perform 1
  from public.estimates
  where id = p_estimate_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Estimate not found';
  end if;

  delete from public.estimates
  where id = p_estimate_id
    and organization_id = p_organization_id;
end;
$$;

-- Reset the role to the default.
reset role;