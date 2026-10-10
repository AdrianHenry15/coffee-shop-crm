begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- =========================================================
-- Fixtures
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values (
  '00000000-0000-4000-8000-000000003401',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'partner-idempotency-owner@test.local',
  ''
);

insert into public.platform_admins (user_id, role)
values (
  '00000000-0000-4000-8000-000000003401',
  'owner'
);

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000003411',
  'Partner Idempotency Test',
  'partner-idempotency-test-034'
);

-- =========================================================
-- Authenticated Platform Owner
-- =========================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003401',
  true
);

-- =========================================================
-- Partner grant
-- =========================================================

select lives_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003411'
    )
  $$,
  'Initial Partner grant succeeds'
);

select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003411'
      and action = 'partner_granted'
  ),
  1,
  'Initial grant creates one audit record'
);

select lives_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003411'
    )
  $$,
  'Repeated Partner grant succeeds'
);

select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003411'
      and action = 'partner_granted'
  ),
  1,
  'Repeated grant does not create another audit record'
);

-- =========================================================
-- Maintenance
-- =========================================================

select lives_ok(
  $$
    select public.set_organization_maintenance(
      '00000000-0000-4000-8000-000000003411',
      '2026-10-01 00:00:00+00',
      '2026-12-01 00:00:00+00'
    )
  $$,
  'Initial maintenance update succeeds'
);

select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003411'
      and action = 'maintenance_updated'
  ),
  1,
  'Initial maintenance update creates one audit record'
);

select lives_ok(
  $$
    select public.set_organization_maintenance(
      '00000000-0000-4000-8000-000000003411',
      '2026-10-01 00:00:00+00',
      '2026-12-01 00:00:00+00'
    )
  $$,
  'Repeated maintenance update succeeds'
);

select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003411'
      and action = 'maintenance_updated'
  ),
  1,
  'Repeated maintenance update does not create another audit record'
);

-- =========================================================
-- Revocation
-- =========================================================

select lives_ok(
  $$
    select public.revoke_organization_partner(
      '00000000-0000-4000-8000-000000003411'
    );

    select public.revoke_organization_partner(
      '00000000-0000-4000-8000-000000003411'
    );
  $$,
  'Repeated Partner revocation succeeds'
);

select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003411'
      and action = 'partner_revoked'
  ),
  1,
  'Repeated revocation creates only one audit record'
);

select * from finish();

rollback;