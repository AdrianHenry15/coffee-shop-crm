-- Stripe billing identifiers belong to organizations.

alter table public.organization_subscriptions
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column stripe_price_id text,
  add column stripe_subscription_status text;

-- Prevent a Stripe customer or subscription from being
-- associated with multiple organizations.

create unique index organization_subscriptions_stripe_customer_unique
on public.organization_subscriptions (stripe_customer_id)
where stripe_customer_id is not null;

create unique index organization_subscriptions_stripe_subscription_unique
on public.organization_subscriptions (stripe_subscription_id)
where stripe_subscription_id is not null;