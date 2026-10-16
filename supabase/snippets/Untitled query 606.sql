SELECT
  o.slug,
  r.id AS reservation_id,
  r.plan_id,
  r.status,
  r.stripe_session_id,
  r.stripe_subscription_id
FROM public.stripe_checkout_reservations r
JOIN public.organizations o
  ON o.id = r.organization_id
WHERE o.slug = 'company-bumpany'
ORDER BY r.created_at DESC;