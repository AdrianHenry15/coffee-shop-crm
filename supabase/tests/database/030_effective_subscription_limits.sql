begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Create a test organization through the existing RPC.
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, created_at, updated_at
)
values (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'effective-limits-test@example.com',
  '',
  now(),
  now()
);

-- These fixtures represent users who confirmed their email.
update auth.users
set email_confirmed_at = now()
where id in (
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  true
);

select public.onboard_organization(
      'Effective Limits Test',
      'effective-limits-test',
      'business@example.com',
      null,
      null,
      null,
      'America/New_York'
    );

create temporary table effective_test_org as
select id
from public.organizations
where slug = 'effective-limits-test';

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- 1. Free Standard.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'customers'
  ),
  25,
  'Free Standard allows 25 customers'
);

-- Grant permanent Partner benefits.
insert into public.organization_benefits (
  organization_id, partner_granted_at
)
values (
  (select id from effective_test_org),
  now() - interval '1 day'
);

-- 2. Free Partner.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'customers'
  ),
  250,
  'Free Partner allows 250 customers'
);

-- Activate Partner+.
update public.organization_benefits
set
  maintenance_starts_at = now() - interval '1 day',
  maintenance_ends_at = now() + interval '30 days'
where organization_id = (select id from effective_test_org);

-- 3. Free Partner+.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'customers'
  ),
  500,
  'Free Partner+ allows 500 customers'
);

-- Switch to Starter.
update public.organization_subscriptions
set plan_id = 'starter'
where organization_id = (select id from effective_test_org);

-- 4. Starter Partner+.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'customers'
  ),
  5000,
  'Starter Partner+ allows 5000 customers'
);

-- 5. Starter Partner+ unlimited estimates.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'estimates'
  ),
  null::integer,
  'Starter Partner+ has unlimited estimates'
);

-- Expire maintenance.
update public.organization_benefits
set
  maintenance_starts_at = now() - interval '60 days',
  maintenance_ends_at = now() - interval '1 day'
where organization_id = (select id from effective_test_org);

-- 6. Starter Partner.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'customers'
  ),
  2500,
  'Expired maintenance returns to Starter Partner limits'
);

-- Switch to Pro.
update public.organization_subscriptions
set plan_id = 'pro'
where organization_id = (select id from effective_test_org);

-- 7. Pro Partner members.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'members'
  ),
  25,
  'Pro Partner allows 25 members'
);

-- 8. Pro Partner unlimited customers.
select is(
  private.get_effective_subscription_limit(
    (select id from effective_test_org), 'customers'
  ),
  null::integer,
  'Pro Partner has unlimited customers'
);

-- 9. Unsupported resource.
select throws_ok(
  format(
    'select private.get_effective_subscription_limit(%L::uuid, %L)',
    (select id from effective_test_org),
    'invoices'
  ),
  '22023',
  null,
  'Unsupported resources are rejected'
);

select finish();

rollback;