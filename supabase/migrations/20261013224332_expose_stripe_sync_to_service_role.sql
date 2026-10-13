DROP FUNCTION IF EXISTS private.sync_stripe_subscription(
  text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.sync_stripe_subscription(
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_plan_id text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT organization_id
  INTO v_organization_id
  FROM public.organization_subscriptions
  WHERE stripe_customer_id = p_customer_id
  FOR UPDATE;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Unknown Stripe customer';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_subscriptions
    WHERE organization_id = v_organization_id
      AND stripe_subscription_id IS NOT NULL
      AND stripe_subscription_id <> p_subscription_id
  ) THEN
    RAISE EXCEPTION 'Conflicting Stripe subscription';
  END IF;

  UPDATE public.organization_subscriptions
  SET
    plan_id = CASE
      WHEN p_status IN ('active', 'trialing') THEN p_plan_id
      ELSE 'free'
    END,
    status = 'active',
    stripe_subscription_id = p_subscription_id,
    stripe_price_id = p_price_id,
    stripe_subscription_status = p_status,
    updated_at = now()
  WHERE organization_id = v_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_stripe_subscription(
  text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_stripe_subscription(
  text, text, text, text, text
) TO service_role;