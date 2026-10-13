SELECT
  s.plan_id,
  s.status,
  s.stripe_subscription_status,
  s.stripe_subscription_id,
  r.status AS checkout_status,
  r.stripe_subscription_id AS reservation_subscription_id
FROM public.organization_subscriptions s
LEFT JOIN public.stripe_checkout_reservations r
  ON r.organization_id = s.organization_id
ORDER BY r.created_at DESC NULLS LAST;