
-- =====================================================
-- Secure estimate deletion
-- =====================================================

-- A dedicated role for deleting estimates.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'estimate_deleter'
  ) then
    create role estimate_deleter nologin noinherit;
  end if;
end;
$$;

grant usage on schema public, private, auth
to estimate_deleter;

-- Required to own a function in the public schema.
grant create on schema public
to estimate_deleter;
grant select, update, delete
on public.estimates
to estimate_deleter;

grant select, delete
on public.estimate_items
to estimate_deleter;

grant select
on public.jobs
to estimate_deleter;

grant execute on function private.is_org_member(uuid)
to estimate_deleter;

-- Restrict direct deletion of estimates.
revoke delete on public.estimates
from authenticated, anon;

-- The dedicated role uses explicit membership-based RLS.
create policy estimate_deleter_select_estimates
on public.estimates
for select
to estimate_deleter
using (private.is_org_member(organization_id));

create policy estimate_deleter_delete_estimates
on public.estimates
for delete
to estimate_deleter
using (private.is_org_member(organization_id));

create policy estimate_deleter_update_estimates
on public.estimates
for update
to estimate_deleter
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id));

create policy estimate_deleter_select_items
on public.estimate_items
for select
to estimate_deleter
using (private.is_org_member(organization_id));

create policy estimate_deleter_delete_items
on public.estimate_items
for delete
to estimate_deleter
using (private.is_org_member(organization_id));

-- Remove trigger-depth authorization.
create or replace function public.enforce_draft_estimate_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  estimate_status text;
begin
  if tg_op = 'DELETE'
     and current_user = 'estimate_deleter' then
    return old;
  end if;

  select e.status
  into estimate_status
  from public.estimates e
  where e.id = case
    when tg_op = 'DELETE' then old.estimate_id
    else new.estimate_id
  end
  for update;

  if estimate_status is null then
    raise exception 'Estimate not found';
  end if;

  if estimate_status <> 'draft' then
    raise exception 'Estimate items can only be modified while draft';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

-- Controlled deletion RPC.
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
  if auth.uid() is null then
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

-- Allow postgres to transfer ownership to the dedicated role.
grant estimate_deleter to postgres
with set true, inherit false;

alter function public.delete_estimate(uuid, uuid)
revoke create on schema public
from estimate_deleter;
owner to estimate_deleter;

revoke all on function public.delete_estimate(uuid, uuid)
from public, anon;

grant execute on function public.delete_estimate(uuid, uuid)
to authenticated;
