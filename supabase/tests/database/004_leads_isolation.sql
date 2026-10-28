
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- ============================================================
-- Fixtures
-- ============================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password
)
values
(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'lead-owner-a@test.local',
  ''
),
(
  '00000000-0000-4000-8000-000000000042',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'lead-owner-b@test.local',
  ''
);

insert into public.organizations (id, name, slug)
values
(
  '10000000-0000-4000-8000-000000000041',
  'Lead Organization A',
  'lead-org-a-test'
),
(
  '10000000-0000-4000-8000-000000000042',
  'Lead Organization B',
  'lead-org-b-test'
);

insert into public.organization_members (
  organization_id, user_id, role, status
)
values
(
  '10000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000041',
  'owner',
  'active'
),
(
  '10000000-0000-4000-8000-000000000042',
  '00000000-0000-4000-8000-000000000042',
  'owner',
  'active'
);

-- ============================================================
-- Organization A
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000041',
  true
);

select lives_ok(
  $$
    insert into public.leads (
      id, organization_id, name, email
    )
    values (
      '20000000-0000-4000-8000-000000000041',
      '10000000-0000-4000-8000-000000000041',
      'Alice Customer',
      'alice@test.local'
    )
  $$,
  'Organization A can create its own lead'
);

select is(
  (
    select name
    from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
  ),
  'Alice Customer',
  'Organization A can read its lead'
);

select lives_ok(
  $$
    update public.leads
    set status = 'contacted'
    where id = '20000000-0000-4000-8000-000000000041'
  $$,
  'Organization A can update its lead'
);

select is(
  (
    select status
    from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
  ),
  'contacted',
  'Organization A lead status was updated'
);

-- ============================================================
-- Organization B
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000042',
  true
);

select is(
  (
    select count(*)::integer
    from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
  ),
  0,
  'Organization B cannot read A lead'
);

-- A filtered UPDATE should affect zero rows.

select results_eq(
  $$
    update public.leads
    set status = 'lost'
    where id = '20000000-0000-4000-8000-000000000041'
    returning id
  $$,
  $$
    select id
    from public.leads
    where false
  $$,
  'Organization B cannot update A lead'
);

-- A filtered DELETE should affect zero rows.

select results_eq(
  $$
    delete from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
    returning id
  $$,
  $$
    select id
    from public.leads
    where false
  $$,
  'Organization B cannot delete A lead'
);

select throws_ok(
  $$
    insert into public.leads (
      organization_id, name
    )
    values (
      '10000000-0000-4000-8000-000000000041',
      'Unauthorized Lead'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "leads"',
  'Organization B cannot insert into A organization'
);

select lives_ok(
  $$
    insert into public.leads (
      organization_id, name
    )
    values (
      '10000000-0000-4000-8000-000000000042',
      'Bob Customer'
    )
  $$,
  'Organization B can create its own lead'
);

select throws_ok(
  $$
    insert into public.leads (
      organization_id, name, status
    )
    values (
      '10000000-0000-4000-8000-000000000042',
      'Invalid Status Lead',
      'unknown'
    )
  $$,
  '23514',
  'new row for relation "leads" violates check constraint "leads_status_check"',
  'Invalid lead statuses are rejected'
);

-- ============================================================
-- Organization A verification and deletion
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000041',
  true
);

-- Confirm User B did not modify or delete A's lead.

select is(
  (
    select status
    from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
  ),
  'contacted',
  'Organization A lead remains unchanged'
);

-- Permanent deletion requires the lead to be trashed first.
select results_eq(
  $$
    delete from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
    returning id
  $$,
  $$
    select null::uuid where false
  $$,
  'Active leads cannot be permanently deleted'
);

select results_eq(
  $$
    update public.leads
    set deleted_at = now()
    where id = '20000000-0000-4000-8000-000000000041'
    returning id
  $$,
  $$
    select '20000000-0000-4000-8000-000000000041'::uuid
  $$,
  'Organization A can move its lead to Recently deleted'
);

-- Confirm authorized deletion returns exactly one row.

select results_eq(
  $$
    delete from public.leads
    where id = '20000000-0000-4000-8000-000000000041'
    returning id
  $$,
  $$
    select '20000000-0000-4000-8000-000000000041'::uuid
  $$,
  'Organization A can delete its own lead'
);

-- ============================================================
-- Anonymous access
-- ============================================================

reset role;
set local role anon;

select set_config(
  'request.jwt.claim.sub',
  '',
  true
);

select is(
  (
    select count(*)::integer
    from public.leads
  ),
  0,
  'Anonymous users cannot read leads'
);

select * from finish();

rollback;
