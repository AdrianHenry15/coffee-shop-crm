CREATE TABLE public.stripe_checkout_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  stripe_session_id text UNIQUE,
  stripe_subscription_id text UNIQUE,

  plan_id text NOT NULL
    REFERENCES public.billing_plans(id),

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN ('pending', 'completed', 'expired', 'canceled')
    ),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stripe_checkout_reservations_paid_plan
    CHECK (plan_id IN ('starter', 'pro'))
);

-- Only one pending Checkout reservation per organization.
CREATE UNIQUE INDEX stripe_checkout_one_pending_per_organization
ON public.stripe_checkout_reservations (organization_id)
WHERE status = 'pending';

CREATE INDEX stripe_checkout_reservations_organization_idx
ON public.stripe_checkout_reservations (organization_id);

ALTER TABLE public.stripe_checkout_reservations
ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: billing writes are server-only.
REVOKE ALL ON public.stripe_checkout_reservations
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.stripe_checkout_reservations
TO service_role;