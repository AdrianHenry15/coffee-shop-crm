-- Prevent moving tenant-owned records between organizations.

create or replace function private.prevent_tenant_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Organization reassignment is not allowed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_customer_reassignment
before update of organization_id on public.customers
for each row
execute function private.prevent_tenant_reassignment();

create trigger prevent_lead_reassignment
before update of organization_id on public.leads
for each row
execute function private.prevent_tenant_reassignment();

create trigger prevent_estimate_reassignment
before update of organization_id on public.estimates
for each row
execute function private.prevent_tenant_reassignment();

create trigger prevent_job_reassignment
before update of organization_id on public.jobs
for each row
execute function private.prevent_tenant_reassignment();

create trigger prevent_member_reassignment
before update of organization_id on public.organization_members
for each row
execute function private.prevent_tenant_reassignment();