BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

DO $$
DECLARE
  v_org_id uuid := gen_random_uuid();
  v_reservation_id uuid;
BEGIN
  INSERT INTO public.organizations (id, name, slug)
  VALUES (
    v_org_id,
    'Checkout Completion Test',
    'checkout-test-' || replace(v_org_id::text, '-', '')
  );

  UPDATE public.organization_subscriptions
  SET
    plan_id = 'free',
    status = 'active',
    stripe_customer_id = 'cus_checkout_test',
    stripe_subscription_id = 'sub_old_expired',
    stripe_price_id = 'price_starter_old',
    stripe_subscription_status = 'incomplete_expired'
  WHERE organization_id = v_org_id;

  INSERT INTO public.stripe_checkout_reservations (
    organization_id,
    plan_id,
    status,
    stripe_session_id
  )
  VALUES (
    v_org_id,
    'starter',
    'pending',
    'cs_checkout_test'
  )
  RETURNING id INTO v_reservation_id;

  PERFORM set_config('test.checkout_org_id', v_org_id::text, true);
  PERFORM set_config(
    'test.checkout_reservation_id',
    v_reservation_id::text,
    true
  );
END;
$$;

SELECT lives_ok(
  $$
    SELECT public.complete_stripe_checkout(
      current_setting('test.checkout_reservation_id')::uuid,
      'cs_checkout_test',
      'cus_checkout_test',
      'sub_new_checkout',
      'price_starter_new',
      'starter',
      'active'
    );
  $$,
  'Checkout replaces an incomplete_expired subscription'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id = current_setting('test.checkout_org_id')::uuid
  ),
  'starter',
  'Checkout activates Starter'
);

SELECT is(
  (
    SELECT status
    FROM public.organization_subscriptions
    WHERE organization_id = current_setting('test.checkout_org_id')::uuid
  ),
  'active',
  'Checkout stores the active app status'
);

SELECT is(
  (
    SELECT stripe_subscription_id
    FROM public.organization_subscriptions
    WHERE organization_id = current_setting('test.checkout_org_id')::uuid
  ),
  'sub_new_checkout',
  'Checkout stores the new Stripe subscription'
);

SELECT is(
  (
    SELECT stripe_price_id
    FROM public.organization_subscriptions
    WHERE organization_id = current_setting('test.checkout_org_id')::uuid
  ),
  'price_starter_new',
  'Checkout stores the new Stripe price'
);

SELECT is(
  (
    SELECT stripe_subscription_status
    FROM public.organization_subscriptions
    WHERE organization_id = current_setting('test.checkout_org_id')::uuid
  ),
  'active',
  'Checkout stores the Stripe subscription status'
);

SELECT is(
  (
    SELECT status
    FROM public.stripe_checkout_reservations
    WHERE id = current_setting('test.checkout_reservation_id')::uuid
  ),
  'completed',
  'Checkout marks the reservation completed'
);

SELECT is(
  (
    SELECT stripe_subscription_id
    FROM public.stripe_checkout_reservations
    WHERE id = current_setting('test.checkout_reservation_id')::uuid
  ),
  'sub_new_checkout',
  'Checkout stores the subscription on the reservation'
);

SELECT lives_ok(
  $$
    SELECT public.complete_stripe_checkout(
      current_setting('test.checkout_reservation_id')::uuid,
      'cs_checkout_test',
      'cus_checkout_test',
      'sub_new_checkout',
      'price_starter_new',
      'starter',
      'active'
    );
  $$,
  'Duplicate Checkout completion is idempotent'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id = current_setting('test.checkout_org_id')::uuid
  ),
  'starter',
  'Duplicate completion preserves Starter'
);

SELECT * FROM finish();

ROLLBACK;