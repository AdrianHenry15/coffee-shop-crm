
CREATE OR REPLACE FUNCTION public.complete_stripe_checkout(
  p_reservation_id uuid,
  p_session_id text,
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
  v_reservation public.stripe_checkout_reservations%ROWTYPE;
  v_subscription public.organization_subscriptions%ROWTYPE;
BEGIN
  -- Lock the organization's subscription first.
  SELECT s.*
  INTO v_subscription
  FROM public.organization_subscriptions s
  JOIN public.stripe_checkout_reservations r
    ON r.organization_id = s.organization_id
  WHERE r.id = p_reservation_id
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization subscription not found';
  END IF;

  -- Lock the exact Checkout reservation.
  SELECT *
  INTO v_reservation
  FROM public.stripe_checkout_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout reservation not found';
  END IF;

  -- Verify the reservation belongs to this Stripe session.
  IF v_reservation.stripe_session_id IS DISTINCT FROM p_session_id
     OR v_reservation.plan_id IS DISTINCT FROM p_plan_id
  THEN
    RAISE EXCEPTION 'Checkout reservation mismatch';
  END IF;

  -- Verify the Stripe customer matches the organization.
  IF v_subscription.stripe_customer_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'Stripe customer mismatch';
  END IF;

  -- Repeated delivery of an already-completed Checkout is safe.
  IF v_reservation.status = 'completed' THEN
    IF v_reservation.stripe_subscription_id = p_subscription_id THEN
      RETURN;
    END IF;

    RAISE EXCEPTION 'Completed reservation subscription mismatch';
  END IF;

  IF v_reservation.status <> 'pending' THEN
    RAISE EXCEPTION 'Checkout reservation is not pending';
  END IF;

  -- Never activate paid entitlements for an unpaid subscription.
  IF p_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'Stripe subscription is not eligible for activation';
  END IF;

  -- A different live subscription cannot be replaced.
  IF v_subscription.stripe_subscription_id IS NOT NULL
     AND v_subscription.stripe_subscription_id <> p_subscription_id
     AND v_subscription.stripe_subscription_status
       IS DISTINCT FROM 'canceled'
  THEN
    RAISE EXCEPTION 'Conflicting Stripe subscription';
  END IF;

  UPDATE public.organization_subscriptions
  SET
    plan_id = p_plan_id,
    status = p_status,
    stripe_subscription_id = p_subscription_id,
    stripe_price_id = p_price_id,
    stripe_subscription_status = p_status,
    updated_at = now()
  WHERE organization_id = v_reservation.organization_id;

  UPDATE public.stripe_checkout_reservations
  SET
    status = 'completed',
    stripe_subscription_id = p_subscription_id,
    updated_at = now()
  WHERE id = p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_stripe_checkout(
  uuid, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_stripe_checkout(
  uuid, text, text, text, text, text, text
) TO service_role;
