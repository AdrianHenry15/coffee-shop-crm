create table public.platform_admins (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  role text not null
    check (role in ('owner', 'admin', 'support')),

  created_at timestamptz not null default now()
);

alter table public.platform_admins
  enable row level security;

-- Administrators may read their own platform role.
create policy "Platform admins can view their own role"
on public.platform_admins
for select
to authenticated
using (
  user_id = (select auth.uid())
);

-- No authenticated client can create, update,
-- or delete platform administrator records.
revoke all on public.platform_admins
from public, anon, authenticated;

grant select on public.platform_admins
to authenticated;