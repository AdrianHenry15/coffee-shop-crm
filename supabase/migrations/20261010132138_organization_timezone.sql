
alter table public.organizations
add column timezone text not null default 'America/New_York';

create or replace function public.validate_organization_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'Invalid organization timezone';
  end if;

  return new;
end;
$$;

create trigger validate_organization_timezone
before insert or update of timezone
on public.organizations
for each row
execute function public.validate_organization_timezone();
