begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

-- =========================================================
-- Fixtures
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000003301',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'platform-owner-033@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000003302',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'platform-admin-033@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000003303',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'platform-support-033@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000003304',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'crm-owner-033@test.local',
  ''
);

insert into public.platform_admins (user_id, role)
values
(
  '00000000-0000-4000-8000-000000003301',
  'owner'
),
(
  '00000000-0000-4000-8000-000000003302',
  'admin'
),
(
  '00000000-0000-4000-8000-000000003303',
  'support'
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000003311',
  'Platform Partner Test A',
  'platform-partner-test-a-033'
),
(
  '00000000-0000-4000-8000-000000003312',
  'Platform Partner Test B',
  'platform-partner-test-b-033'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status
)
values (
  '00000000-0000-4000-8000-000000003311',
  '00000000-0000-4000-8000-000000003301',
  'member',
  'active'
);

-- =========================================================
-- Platform Owner
-- =========================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003301',
  true
);

-- 1. Owner can grant Partner.
select lives_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003311'
    )
  $$,
  'Platform Owner can grant Partner'
);

-- 2. Partner level activates.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003311'
    )
    where resource = 'customers'
  ),
  250,
  'Grant activates Partner customer limits'
);

-- 3. Audit records the grant.
select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003311'
      and actor_user_id =
        '00000000-0000-4000-8000-000000003301'
      and action = 'partner_granted'
  ),
  1,
  'Partner grant is audited with the correct actor'
);

-- 4. Duplicate grant preserves the original timestamp.
select lives_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003311'
    )
  $$,
  'Repeated Partner grant succeeds'
);

select is(
  (
    select count(*)::integer
    from public.organization_benefits
    where organization_id =
      '00000000-0000-4000-8000-000000003311'
      and partner_granted_at is not null
  ),
  1,
  'Repeated grant retains one Partner benefit record'
);

-- =========================================================
-- Maintenance
-- =========================================================

-- 6. Activate Partner+.
select lives_ok(
  $$
    select public.set_organization_maintenance(
      '00000000-0000-4000-8000-000000003311',
      now() - interval '1 day',
      now() + interval '30 days'
    )
  $$,
  'Owner can activate maintenance'
);

-- 7. Partner+ activates.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003311'
    )
    where resource = 'customers'
  ),
  500,
  'Active maintenance activates Partner+ customer limits'
);

-- 8. Maintenance update is audited.
select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003311'
      and action = 'maintenance_updated'
  ),
  1,
  'Maintenance activation is audited'
);

-- 9. Invalid maintenance dates rejected.
select throws_ok(
  $$
    select public.set_organization_maintenance(
      '00000000-0000-4000-8000-000000003311',
      now() + interval '30 days',
      now()
    )
  $$,
  '22023',
  'Maintenance end must be after start',
  'Invalid maintenance dates are rejected'
);

-- 10. Clearing maintenance restores Partner.
select lives_ok(
  $$
    select public.set_organization_maintenance(
      '00000000-0000-4000-8000-000000003311',
      null,
      null
    )
  $$,
  'Owner can clear maintenance'
);

-- 11. 

select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003311'
    )
    where resource = 'customers'
  ),
  250,
  'Clearing maintenance restores Partner customer limits'
);

-- =========================================================
-- Revocation
-- =========================================================

-- 12. Owner can revoke Partner.
select lives_ok(
  $$
    select public.revoke_organization_partner(
      '00000000-0000-4000-8000-000000003311'
    )
  $$,
  'Owner can revoke Partner'
);

-- 13. Benefits return to Standard.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003311'
    )
    where resource = 'customers'
  ),
  25,
  'Revocation restores Standard customer limits'
);

-- 14. Revocation is audited.
select is(
  (
    select count(*)::integer
    from public.platform_admin_audit_logs
    where organization_id =
      '00000000-0000-4000-8000-000000003311'
      and action = 'partner_revoked'
  ),
  1,
  'Partner revocation is audited'
);

-- =========================================================
-- Platform Admin
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003302',
  true
);

-- 15. Platform Admin can grant Partner.
select lives_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003312'
    )
  $$,
  'Platform Admin can grant Partner'
);

-- =========================================================
-- Platform Support
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003303',
  true
);

-- 16. Support cannot grant Partner.
select throws_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003311'
    )
  $$,
  '42501',
  'Platform administrator access required',
  'Platform Support cannot grant Partner'
);

-- 17. Support cannot modify maintenance.
select throws_ok(
  $$
    select public.set_organization_maintenance(
      '00000000-0000-4000-8000-000000003312',
      now(),
      now() + interval '30 days'
    )
  $$,
  '42501',
  'Platform administrator access required',
  'Platform Support cannot modify maintenance'
);

-- =========================================================
-- Ordinary CRM Organization Owner
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003304',
  true
);

-- 18. CRM owner cannot revoke Partner.
select throws_ok(
  $$
    select public.revoke_organization_partner(
      '00000000-0000-4000-8000-000000003312'
    )
  $$,
  '42501',
  'Platform administrator access required',
  'CRM Organization Owner cannot revoke Partner'
);

-- =========================================================
-- Anonymous execution
-- =========================================================

reset role;

select set_config('request.jwt.claim.sub', '', true);

set local role anon;

-- 19. Anonymous users cannot execute admin RPCs.
select throws_ok(
  $$
    select public.grant_organization_partner(
      '00000000-0000-4000-8000-000000003311'
    )
  $$,
  '42501',
  null,
  'Anonymous users cannot execute Partner administration'
);

select * from finish();

rollback;