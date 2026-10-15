
CREATE OR REPLACE FUNCTION public.complete_stripe_subscription_upgrade(
  p_change_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_invoice_id text,
  p_price_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_change public.stripe_subscription_changes%ROWTYPE;
  v_subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  IF p_customer_id IS NULL
    OR p_subscription_id IS NULL
    OR p_invoice_id IS NULL
    OR p_price_id IS NULL
  THEN
    RAISE EXCEPTION 'Missing Stripe upgrade identifiers';
  END IF;

  -- Lock the organization's subscription first.
  SELECT s.*
  INTO v_subscription
  FROM public.organization_subscriptions AS s
  JOIN public.stripe_subscription_changes AS c
    ON c.organization_id = s.organization_id
  WHERE c.id = p_change_id
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization subscription not found';
  END IF;

  -- Lock the change request in the same transaction.
  SELECT *
  INTO v_change
  FROM public.stripe_subscription_changes
  WHERE id = p_change_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription change not found';
  END IF;

  -- Allow safe webhook retries.
  IF v_change.status = 'completed' THEN
    IF v_change.stripe_subscription_id <> p_subscription_id
      OR v_change.stripe_invoice_id IS DISTINCT FROM p_invoice_id
      OR v_subscription.plan_id <> 'pro'
    THEN
      RAISE EXCEPTION 'Completed upgrade does not match';
    END IF;

    RETURN;
  END IF;

  IF v_change.change_type <> 'upgrade'
    OR v_change.from_plan_id <> 'starter'
    OR v_change.to_plan_id <> 'pro'
    OR v_change.status NOT IN ('pending', 'awaiting_payment')
  THEN
    RAISE EXCEPTION 'Invalid upgrade request';
  END IF;

  IF v_subscription.plan_id <> 'starter'
    OR v_subscription.stripe_customer_id IS DISTINCT FROM p_customer_id
    OR v_subscription.stripe_subscription_id IS DISTINCT FROM p_subscription_id
    OR v_change.stripe_subscription_id <> p_subscription_id
  THEN
    RAISE EXCEPTION 'Subscription does not match upgrade request';
  END IF;

  -- The invoice must already be associated with this request.
  IF v_change.stripe_invoice_id IS DISTINCT FROM p_invoice_id THEN
    RAISE EXCEPTION 'Upgrade invoice does not match';
  END IF;

  IF p_price_id = '' THEN
    RAISE EXCEPTION 'Missing Pro price identifier';
  END IF;

  -- Stripe payment and price verification must occur in
  -- trusted server code before calling this function.
  UPDATE public.organization_subscriptions
  SET
    plan_id = 'pro',
    status = 'active',
    stripe_price_id = p_price_id,
    stripe_subscription_status = 'active',
    updated_at = now()
  WHERE organization_id = v_change.organization_id;

  UPDATE public.stripe_subscription_changes
  SET
    status = 'completed',
    updated_at = now()
  WHERE id = v_change.id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_stripe_subscription_upgrade(
  uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_stripe_subscription_upgrade(
  uuid, text, text, text, text
) TO service_role;
