
create function public.prevent_lead_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Lead organization cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_lead_organization_change
before update on public.leads
for each row
execute function public.prevent_lead_organization_change();
