
-- Track requested changes to existing Stripe subscriptions.
-- A request is not proof that a payment succeeded.

CREATE TABLE public.stripe_subscription_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  stripe_subscription_id text NOT NULL,

  from_plan_id text NOT NULL
    CHECK (from_plan_id IN ('starter', 'pro')),

  to_plan_id text NOT NULL
    CHECK (to_plan_id IN ('starter', 'pro')),

  change_type text NOT NULL
    CHECK (change_type IN ('upgrade', 'downgrade')),

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'awaiting_payment',
        'scheduled',
        'completed',
        'failed',
        'canceled'
      )
    ),

  stripe_invoice_id text,
  stripe_schedule_id text,

  effective_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stripe_subscription_changes_different_plans
    CHECK (from_plan_id <> to_plan_id),

  CONSTRAINT stripe_subscription_changes_direction
    CHECK (
      (change_type = 'upgrade'
        AND from_plan_id = 'starter'
        AND to_plan_id = 'pro')
      OR
      (change_type = 'downgrade'
        AND from_plan_id = 'pro'
        AND to_plan_id = 'starter')
    )
);

-- Prevent multiple simultaneous plan-change workflows
-- for the same organization.
CREATE UNIQUE INDEX stripe_subscription_changes_one_open
ON public.stripe_subscription_changes (organization_id)
WHERE status IN ('pending', 'awaiting_payment', 'scheduled');

CREATE INDEX stripe_subscription_changes_subscription_idx
ON public.stripe_subscription_changes (stripe_subscription_id);

CREATE INDEX stripe_subscription_changes_organization_idx
ON public.stripe_subscription_changes (organization_id);

-- Billing workflows are performed through trusted server code.
ALTER TABLE public.stripe_subscription_changes
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_subscription_changes
FROM anon, authenticated;

GRANT ALL ON TABLE public.stripe_subscription_changes
TO service_role;
