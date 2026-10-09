-- Prevent invalid membership roles.
alter table public.organization_members
add constraint organization_members_role_check
check (role in ('owner', 'admin', 'member'));

-- Prevent invalid membership statuses.
alter table public.organization_members
add constraint organization_members_status_check
check (status in ('active', 'invited', 'suspended'));

-- Prevent blank organization names and slugs.
alter table public.organizations
add constraint organizations_name_not_blank
check (length(trim(name)) > 0);

alter table public.organizations
add constraint organizations_slug_format_check
check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');