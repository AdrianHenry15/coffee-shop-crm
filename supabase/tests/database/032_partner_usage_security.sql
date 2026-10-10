begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- =========================================================
-- Fixtures
-- =========================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000003201',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'partner-owner@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000003202',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'partner-outsider@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000003203',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'partner-suspended@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values
(
  '00000000-0000-4000-8000-000000003211',
  'Partner Security Organization A',
  'partner-security-a-032'
),
(
  '00000000-0000-4000-8000-000000003212',
  'Partner Security Organization B',
  'partner-security-b-032'
);

insert into public.organization_members (
  organization_id, user_id, role, status
)
values
(
  '00000000-0000-4000-8000-000000003211',
  '00000000-0000-4000-8000-000000003201',
  'owner',
  'active'
),
(
  '00000000-0000-4000-8000-000000003212',
  '00000000-0000-4000-8000-000000003202',
  'owner',
  'active'
),
(
  '00000000-0000-4000-8000-000000003211',
  '00000000-0000-4000-8000-000000003203',
  'member',
  'suspended'
);

-- Grant Partner benefits to Organization A.
insert into public.organization_benefits (
  organization_id,
  partner_granted_at
)
values (
  '00000000-0000-4000-8000-000000003211',
  now() - interval '7 days'
);

-- =========================================================
-- Authenticated Organization A owner
-- =========================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003201',
  true
);

-- 1. Owner sees Partner customer limit.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003211'
    )
    where resource = 'customers'
  ),
  250,
  'Partner owner sees enhanced customer limit'
);

-- 2. Owner sees Partner member limit.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003211'
    )
    where resource = 'members'
  ),
  3,
  'Partner owner sees enhanced member limit'
);

-- 3. Owner can call the secured wrapper for own organization.
select is(
  private.get_subscription_usage_limit(
    '00000000-0000-4000-8000-000000003211',
    'customers'
  ),
  250,
  'Member can retrieve own organization effective limit'
);

-- 4. Owner cannot read Organization B usage.
select throws_ok(
  $$
    select *
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003212'
    )
  $$,
  '42501',
  'Organization access denied',
  'Cross-organization usage access is rejected'
);

-- 5. Owner cannot access Organization B through wrapper.
select throws_ok(
  $$
    select private.get_subscription_usage_limit(
      '00000000-0000-4000-8000-000000003212',
      'customers'
    )
  $$,
  '42501',
  'Organization access denied',
  'Cross-organization wrapper access is rejected'
);

-- 6. Owner cannot grant themselves Partner benefits.
select throws_ok(
  $$
    insert into public.organization_benefits (
      organization_id,
      partner_granted_at
    )
    values (
      '00000000-0000-4000-8000-000000003212',
      now()
    )
  $$,
  '42501',
  null,
  'Ordinary users cannot grant Partner benefits'
);

-- 7. Owner cannot modify existing Partner benefits.
select throws_ok(
  $$
    update public.organization_benefits
    set maintenance_starts_at = now(),
        maintenance_ends_at = now() + interval '30 days'
    where organization_id =
      '00000000-0000-4000-8000-000000003211'
  $$,
  '42501',
  null,
  'Ordinary users cannot modify Partner benefits'
);

-- =========================================================
-- Suspended member
-- =========================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003203',
  true
);

-- 8. Suspended member cannot retrieve usage.
select throws_ok(
  $$
    select *
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003211'
    )
  $$,
  '42501',
  'Organization access denied',
  'Suspended member cannot read usage'
);

-- 9. Suspended member cannot call wrapper.
select throws_ok(
  $$
    select private.get_subscription_usage_limit(
      '00000000-0000-4000-8000-000000003211',
      'customers'
    )
  $$,
  '42501',
  'Organization access denied',
  'Suspended member cannot access effective limits'
);

-- =========================================================
-- Anonymous user
-- =========================================================

reset role;

select set_config('request.jwt.claim.sub', '', true);

set local role anon;

-- 10. Anonymous users cannot execute the usage RPC.
select throws_ok(
  $$
    select *
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003211'
    )
  $$,
  '42501',
  'permission denied for function get_organization_subscription_usage',
  'Anonymous user cannot retrieve subscription usage'
);

-- 11. Anonymous wrapper execution rejected.
select throws_ok(
  $$
    select private.get_subscription_usage_limit(
      '00000000-0000-4000-8000-000000003211',
      'customers'
    )
  $$,
  '42501',
  null,
  'Anonymous user cannot execute privileged wrapper'
);

-- =========================================================
-- Partner+ reporting
-- =========================================================

set local role postgres;

update public.organization_benefits
set
  maintenance_starts_at = now() - interval '1 day',
  maintenance_ends_at = now() + interval '30 days'
where organization_id =
  '00000000-0000-4000-8000-000000003211';

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003201',
  true
);

-- 12. Partner+ customer limit.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003211'
    )
    where resource = 'customers'
  ),
  500,
  'Partner+ customer limit is reported correctly'
);

-- 13. Partner+ member limit.
select is(
  (
    select resource_limit
    from public.get_organization_subscription_usage(
      '00000000-0000-4000-8000-000000003211'
    )
    where resource = 'members'
  ),
  5,
  'Partner+ member limit is reported correctly'
);

select * from finish();

rollback;