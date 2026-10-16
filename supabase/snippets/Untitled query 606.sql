SELECT
  o.slug,
  s.plan_id,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.stripe_subscription_status,
  r.status AS checkout_status,
  r.stripe_subscription_id AS reservation_subscription_id
FROM public.organizations AS o
JOIN public.organization_subscriptions AS s
  ON s.organization_id = o.id
LEFT JOIN public.stripe_checkout_reservations AS r
  ON r.organization_id = o.id
WHERE o.slug = 'test-company-2'
ORDER BY r.created_at DESC
LIMIT 5;