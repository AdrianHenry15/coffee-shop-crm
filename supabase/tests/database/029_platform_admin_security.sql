begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- Use transaction-local test identities.
-- These UUIDs are test identities, not production users.
-- JWT claims simulate authenticated Supabase requests.

create temporary table test_admin_users (
  owner_id uuid,
  admin_id uuid,
  support_id uuid,
  regular_id uuid
);

insert into test_admin_users
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);

-- Create actual Auth fixtures to satisfy the foreign key.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  created_at,
  updated_at
)
select
  id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  email,
  '',
  now(),
  now()
from (
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'test-owner@example.com'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'test-admin@example.com'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'test-support@example.com'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'test-regular@example.com')
) as users(id, email);

insert into public.platform_admins (user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'admin'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'support');

-- Regular user.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  true
);

select is(
  (select count(*)::integer from public.platform_admins),
  0,
  'Regular users cannot see platform administrators'
);

select is(
  private.is_platform_admin(),
  false,
  'Regular users are not platform administrators'
);

select throws_ok(
  $$
    insert into public.platform_admins (user_id, role)
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'owner'
    )
  $$,
  '42501',
  null,
  'Regular users cannot promote themselves'
);

-- Owner.
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);

select is(
  private.is_platform_admin(),
  true,
  'Owner passes platform administrator check'
);

select is(
  (select count(*)::integer from public.platform_admins),
  1,
  'Owner can see only their own administrator record'
);

-- Admin.
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  true
);

select is(
  private.is_platform_admin(),
  true,
  'Admin passes platform administrator check'
);

-- Support.
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  true
);

select is(
  private.is_platform_admin(),
  false,
  'Support does not receive administrator authority'
);

select throws_ok(
  $$
    update public.platform_admins
    set role = 'owner'
    where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  $$,
  '42501',
  null,
  'Support cannot promote themselves'
);

select finish();

rollback;