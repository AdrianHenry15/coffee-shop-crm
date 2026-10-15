
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

-- All fixtures are transaction-scoped.
-- ROLLBACK prevents test data from persisting.

DO $$
DECLARE
  v_org_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organizations (
    id,
    name,
    slug
  )
  VALUES (
    v_org_id,
    'Stripe Regression Test',
    'stripe-regression-' || replace(v_org_id::text, '-', '')
  );

  PERFORM set_config(
    'test.stripe_org_id',
    v_org_id::text,
    true
  );
END;
$$;

-- =========================================================
-- PART 1: Existing subscription regression tests
-- =========================================================

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'free',
  'New organizations begin on Free'
);

UPDATE public.organization_subscriptions
SET
  plan_id = 'starter',
  status = 'active',
  stripe_customer_id = 'cus_regression_test',
  stripe_subscription_id = 'sub_regression_test',
  stripe_price_id = 'price_starter_regression',
  stripe_subscription_status = 'active'
WHERE organization_id =
  current_setting('test.stripe_org_id')::uuid;

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'starter',
  'Test subscription starts on Starter'
);

SELECT lives_ok(
  $$
    SELECT public.sync_stripe_subscription(
      'cus_regression_test',
      'sub_regression_test',
      'price_starter_regression',
      'starter',
      'active'
    );
  $$,
  'Normal Starter synchronization succeeds'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'starter',
  'Normal synchronization retains Starter'
);

INSERT INTO public.stripe_subscription_changes (
  organization_id,
  stripe_subscription_id,
  from_plan_id,
  to_plan_id,
  change_type,
  status
)
VALUES (
  current_setting('test.stripe_org_id')::uuid,
  'sub_regression_test',
  'starter',
  'pro',
  'upgrade',
  'awaiting_payment'
);

SELECT lives_ok(
  $$
    SELECT public.sync_stripe_subscription(
      'cus_regression_test',
      'sub_regression_test',
      'price_pro_regression',
      'pro',
      'active'
    );
  $$,
  'Pending upgrade synchronization is safely ignored'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'starter',
  'Unpaid upgrade does not unlock Pro'
);

SELECT lives_ok(
  $$
    SELECT public.sync_stripe_subscription(
      'cus_regression_test',
      'sub_regression_test',
      'price_starter_regression',
      'starter',
      'canceled'
    );
  $$,
  'Cancellation is processed despite pending upgrade'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'free',
  'Cancellation revokes Starter entitlements'
);

SELECT is(
  (
    SELECT stripe_subscription_status
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'canceled',
  'Cancellation status is retained'
);

SELECT is(
  (
    SELECT status
    FROM public.stripe_subscription_changes
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'canceled',
  'Cancellation closes the pending upgrade'
);

-- =========================================================
-- PART 2: Paid Starter -> Pro upgrade
-- =========================================================

-- Reset the test organization to an active Starter plan.
-- The previous change is already canceled.

UPDATE public.organization_subscriptions
SET
  plan_id = 'starter',
  status = 'active',
  stripe_customer_id = 'cus_regression_test',
  stripe_subscription_id = 'sub_regression_test',
  stripe_price_id = 'price_starter_regression',
  stripe_subscription_status = 'active'
WHERE organization_id =
  current_setting('test.stripe_org_id')::uuid;

INSERT INTO public.stripe_subscription_changes (
  organization_id,
  stripe_subscription_id,
  from_plan_id,
  to_plan_id,
  change_type,
  status,
  stripe_invoice_id
)
VALUES (
  current_setting('test.stripe_org_id')::uuid,
  'sub_regression_test',
  'starter',
  'pro',
  'upgrade',
  'awaiting_payment',
  'in_paid_upgrade_regression'
);

-- The completion RPC is privileged.
-- These tests assume the test runner has permission
-- to execute the function.

SELECT lives_ok(
  $$
    SELECT public.complete_stripe_subscription_upgrade(
      (
        SELECT id
        FROM public.stripe_subscription_changes
        WHERE organization_id =
          current_setting('test.stripe_org_id')::uuid
          AND stripe_invoice_id = 'in_paid_upgrade_regression'
      ),
      'cus_regression_test',
      'sub_regression_test',
      'in_paid_upgrade_regression',
      'price_pro_regression'
    );
  $$,
  'Confirmed upgrade completion succeeds'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'pro',
  'Completed upgrade activates Pro'
);

SELECT is(
  (
    SELECT stripe_price_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'price_pro_regression',
  'Completed upgrade stores the Pro price'
);

SELECT is(
  (
    SELECT status
    FROM public.stripe_subscription_changes
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
      AND stripe_invoice_id = 'in_paid_upgrade_regression'
  ),
  'completed',
  'Upgrade change is marked completed'
);

-- Webhook retries must not corrupt completed upgrades.

SELECT lives_ok(
  $$
    SELECT public.complete_stripe_subscription_upgrade(
      (
        SELECT id
        FROM public.stripe_subscription_changes
        WHERE organization_id =
          current_setting('test.stripe_org_id')::uuid
          AND stripe_invoice_id = 'in_paid_upgrade_regression'
      ),
      'cus_regression_test',
      'sub_regression_test',
      'in_paid_upgrade_regression',
      'price_pro_regression'
    );
  $$,
  'Repeated upgrade completion is idempotent'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'pro',
  'Repeated completion preserves Pro'
);

-- =========================================================
-- PART 3: Reject invalid upgrade completion
-- =========================================================

-- Reset to Starter and create a fresh pending upgrade.
-- The completed change remains in history.

UPDATE public.organization_subscriptions
SET
  plan_id = 'starter',
  status = 'active',
  stripe_price_id = 'price_starter_regression',
  stripe_subscription_status = 'active'
WHERE organization_id =
  current_setting('test.stripe_org_id')::uuid;

INSERT INTO public.stripe_subscription_changes (
  organization_id,
  stripe_subscription_id,
  from_plan_id,
  to_plan_id,
  change_type,
  status,
  stripe_invoice_id
)
VALUES (
  current_setting('test.stripe_org_id')::uuid,
  'sub_regression_test',
  'starter',
  'pro',
  'upgrade',
  'awaiting_payment',
  'in_invalid_upgrade_regression'
);

SELECT throws_ok(
  $$
    SELECT public.complete_stripe_subscription_upgrade(
      (
        SELECT id
        FROM public.stripe_subscription_changes
        WHERE organization_id =
          current_setting('test.stripe_org_id')::uuid
          AND stripe_invoice_id = 'in_invalid_upgrade_regression'
      ),
      'cus_wrong_customer',
      'sub_regression_test',
      'in_invalid_upgrade_regression',
      'price_pro_regression'
    );
  $$,
  'P0001',
  'Subscription does not match upgrade request',
  'Wrong Stripe customer is rejected'
);

SELECT throws_ok(
  $$
    SELECT public.complete_stripe_subscription_upgrade(
      (
        SELECT id
        FROM public.stripe_subscription_changes
        WHERE organization_id =
          current_setting('test.stripe_org_id')::uuid
          AND stripe_invoice_id = 'in_invalid_upgrade_regression'
      ),
      'cus_regression_test',
      'sub_regression_test',
      'in_wrong_invoice',
      'price_pro_regression'
    );
  $$,
  'P0001',
  'Upgrade invoice does not match',
  'Wrong upgrade invoice is rejected'
);

SELECT is(
  (
    SELECT plan_id
    FROM public.organization_subscriptions
    WHERE organization_id =
      current_setting('test.stripe_org_id')::uuid
  ),
  'starter',
  'Rejected completions do not activate Pro'
);

SELECT * FROM finish();

ROLLBACK;
