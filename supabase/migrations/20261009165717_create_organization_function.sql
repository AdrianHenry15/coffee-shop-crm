
create or replace function public.create_organization(
  org_name text,
  org_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if org_name is null
    or length(trim(org_name)) = 0
    or length(org_name) > 100 then
    raise exception 'Invalid organization name'
      using errcode = '22023';
  end if;

  if org_slug is null
    or length(org_slug) > 60
    or org_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid organization slug'
      using errcode = '22023';
  end if;

  insert into public.organizations (name, slug)
  values (trim(org_name), org_slug)
  returning id into new_org_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    new_org_id,
    current_user_id,
    'owner',
    'active'
  );

  return new_org_id;
end;
$$;

revoke all on function public.create_organization(text, text)
from public, anon;

grant execute on function public.create_organization(text, text)
to authenticated;
