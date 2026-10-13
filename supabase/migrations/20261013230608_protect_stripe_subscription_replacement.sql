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
  v_subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_subscription
  FROM public.organization_subscriptions
  WHERE stripe_customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown Stripe customer';
  END IF;

  -- A webhook from a historical subscription must never
  -- overwrite the currently tracked subscription.
  IF v_subscription.stripe_subscription_id IS NOT NULL
     AND v_subscription.stripe_subscription_id <> p_subscription_id
  THEN
    -- Only permit replacement when the previous subscription
    -- is canceled and the incoming one is eligible for access.
    IF v_subscription.stripe_subscription_status = 'canceled'
       AND p_status IN ('active', 'trialing')
    THEN
      NULL;
    ELSE
      -- Ignore historical or conflicting subscription events.
      RETURN;
    END IF;
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
  WHERE organization_id = v_subscription.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_stripe_subscription(
  text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_stripe_subscription(
  text, text, text, text, text
) TO service_role;