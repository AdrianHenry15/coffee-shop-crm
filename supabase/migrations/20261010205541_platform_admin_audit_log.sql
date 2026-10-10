-- =========================================================
-- Platform administrative audit log
-- =========================================================

create table public.platform_admin_audit_logs (
  id bigint generated always as identity primary key,

  actor_user_id uuid not null
    references auth.users(id),

  organization_id uuid not null
    references public.organizations(id),

  action text not null
    check (
      action in (
        'partner_granted',
        'partner_revoked',
        'maintenance_updated'
      )
    ),

  previous_values jsonb,
  new_values jsonb,

  created_at timestamptz not null default now()
);

create index platform_admin_audit_logs_organization_idx
on public.platform_admin_audit_logs (
  organization_id,
  created_at desc
);

create index platform_admin_audit_logs_actor_idx
on public.platform_admin_audit_logs (
  actor_user_id,
  created_at desc
);

-- =========================================================
-- Security
-- =========================================================

alter table public.platform_admin_audit_logs
  enable row level security;

-- No direct access for ordinary authenticated users.
revoke all on public.platform_admin_audit_logs
from public, anon, authenticated;

-- Platform owners/admins can inspect audit history.
create policy "Platform admins can read audit logs"
on public.platform_admin_audit_logs
for select
to authenticated
using (
  (select private.is_platform_admin())
);

grant select on public.platform_admin_audit_logs
to authenticated;