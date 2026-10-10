-- =========================================================
-- CoffeeShopCRM subscription foundation
-- =========================================================

create table public.billing_plans (
  id text primary key,
  name text not null,
  max_members integer,
  max_customers integer,
  max_leads integer,
  max_estimates integer,
  max_jobs integer,

  constraint billing_plan_limits_valid check (
    (max_members is null or max_members >= 0)
    and (max_customers is null or max_customers >= 0)
    and (max_leads is null or max_leads >= 0)
    and (max_estimates is null or max_estimates >= 0)
    and (max_jobs is null or max_jobs >= 0)
  )
);

insert into public.billing_plans (
  id, name, max_members, max_customers,
  max_leads, max_estimates, max_jobs
)
values
  ('free', 'Free', 1, 25, 25, 10, 10),
  ('starter', 'Starter', 3, 500, 250, null, null),
  ('pro', 'Pro', 10, null, null, null, null);

create table public.organization_subscriptions (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,

  plan_id text not null default 'free'
    references public.billing_plans(id),

  status text not null default 'active'
    check (status in (
      'active', 'trialing', 'past_due', 'canceled', 'unpaid'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Assign Free to every newly created organization.

create function private.create_free_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_subscriptions (organization_id)
  values (new.id);

  return new;
end;
$$;

create trigger organization_default_subscription
after insert on public.organizations
for each row
execute function private.create_free_subscription();

-- Backfill organizations that already exist.

insert into public.organization_subscriptions (organization_id)
select id
from public.organizations
on conflict (organization_id) do nothing;

-- =========================================================
-- RLS
-- =========================================================

alter table public.billing_plans enable row level security;
alter table public.organization_subscriptions enable row level security;

create policy "Authenticated users can view billing plans"
on public.billing_plans
for select
to authenticated
using (true);

create policy "Members can view organization subscription"
on public.organization_subscriptions
for select
to authenticated
using (
  (select private.is_org_member(organization_id))
);

-- No direct client INSERT, UPDATE or DELETE policies.
-- Plan changes will eventually be handled by trusted
-- billing operations and verified Stripe webhooks.