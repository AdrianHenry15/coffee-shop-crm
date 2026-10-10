
begin;

set local search_path = public, extensions;

select plan(9);

-- Setup
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000001301',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'status-test@example.com',
  '',
  now(), now(), now()
);

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000001311',
  'Status Test Organization',
  'status-test-013'
);

insert into public.organization_members (
  organization_id, user_id, role
)
values (
  '00000000-0000-4000-8000-000000001311',
  '00000000-0000-4000-8000-000000001301',
  'owner'
);

insert into public.customers (
  id, organization_id, name
)
values (
  '00000000-0000-4000-8000-000000001321',
  '00000000-0000-4000-8000-000000001311',
  'Status Customer'
);

insert into public.estimates (
  id, organization_id, customer_id, status
)
values (
  '00000000-0000-4000-8000-000000001331',
  '00000000-0000-4000-8000-000000001311',
  '00000000-0000-4000-8000-000000001321',
  'draft'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001301',
  true
);

-- Test 1: Cannot accept a draft directly.
select throws_ok(
  $$
    update public.estimates
    set status = 'accepted'
    where id = '00000000-0000-4000-8000-000000001331'
  $$,
  '23514'
);

-- Test 2: Draft remains unchanged.
select is(
  (select status from public.estimates
   where id = '00000000-0000-4000-8000-000000001331'),
  'draft',
  'Invalid transition preserves draft status'
);

-- Test 3: Draft can be sent.
update public.estimates
set status = 'sent'
where id = '00000000-0000-4000-8000-000000001331';

select is(
  (select status from public.estimates
   where id = '00000000-0000-4000-8000-000000001331'),
  'sent',
  'Draft can transition to sent'
);

-- Test 4: Sent cannot return to draft.
select throws_ok(
  $$
    update public.estimates
    set status = 'draft'
    where id = '00000000-0000-4000-8000-000000001331'
  $$,
  '23514'
);

-- Test 5: Sent can be accepted.
update public.estimates
set status = 'accepted'
where id = '00000000-0000-4000-8000-000000001331';

select is(
  (select status from public.estimates
   where id = '00000000-0000-4000-8000-000000001331'),
  'accepted',
  'Sent can transition to accepted'
);

-- Test 6: Accepted cannot return to sent.
select throws_ok(
  $$
    update public.estimates
    set status = 'sent'
    where id = '00000000-0000-4000-8000-000000001331'
  $$,
  '23514'
);

-- Test 7: Accepted cannot be declined.
select throws_ok(
  $$
    update public.estimates
    set status = 'declined'
    where id = '00000000-0000-4000-8000-000000001331'
  $$,
  '23514'
);

-- Test 8: Unchanged status is allowed.
update public.estimates
set status = 'accepted'
where id = '00000000-0000-4000-8000-000000001331';

select is(
  (select status from public.estimates
   where id = '00000000-0000-4000-8000-000000001331'),
  'accepted',
  'Repeating the current status is allowed'
);

-- Test 9: Accepted cannot return to draft.
select throws_ok(
  $$
    update public.estimates
    set status = 'draft'
    where id = '00000000-0000-4000-8000-000000001331'
  $$,
  '23514'
);

select * from finish();

rollback;
