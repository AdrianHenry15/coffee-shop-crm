
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
  v_change public.stripe_subscription_changes%ROWTYPE;
  v_next_plan text;
BEGIN
  IF NULLIF(p_customer_id, '') IS NULL
    OR NULLIF(p_subscription_id, '') IS NULL
    OR NULLIF(p_price_id, '') IS NULL
    OR p_plan_id IS NULL
    OR p_plan_id NOT IN ('starter', 'pro')
    OR NULLIF(p_status, '') IS NULL
  THEN
    RAISE EXCEPTION 'Invalid Stripe subscription data';
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.organization_subscriptions
  WHERE stripe_customer_id = p_customer_id
    AND stripe_subscription_id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_change
  FROM public.stripe_subscription_changes
  WHERE organization_id = v_subscription.organization_id
    AND stripe_subscription_id = p_subscription_id
    AND status IN (
      'pending',
      'awaiting_payment',
      'scheduled'
    )
  FOR UPDATE;

  -- Terminal subscription states take priority over
  -- pending upgrades and scheduled downgrades.
  IF p_status IN ('canceled', 'incomplete_expired') THEN

    UPDATE public.organization_subscriptions
    SET
      plan_id = 'free',
      status = 'active',
      stripe_subscription_status = p_status,
      updated_at = now()
    WHERE organization_id = v_subscription.organization_id;

    UPDATE public.stripe_subscription_changes
    SET
      status = 'canceled',
      updated_at = now()
    WHERE organization_id = v_subscription.organization_id
      AND stripe_subscription_id = p_subscription_id
      AND status IN (
        'pending',
        'awaiting_payment',
        'scheduled'
      );

    RETURN;
  END IF;

  -- Never grant or remove paid-plan entitlements
  -- while a plan change is unresolved.
  IF v_change.id IS NOT NULL THEN
    RETURN;
  END IF;

  -- Direct paid-to-paid changes require a separate
  -- verified billing workflow.
  IF v_subscription.plan_id IN ('starter', 'pro')
    AND p_plan_id <> v_subscription.plan_id
    AND p_status IN ('active', 'trialing')
  THEN
    RAISE EXCEPTION
      'Paid plan changes require a verified change workflow';
  END IF;

  v_next_plan :=
    CASE
      WHEN p_status IN ('active', 'trialing')
        THEN p_plan_id
      ELSE 'free'
    END;

  UPDATE public.organization_subscriptions
  SET
    plan_id = v_next_plan,
    status = 'active',
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
