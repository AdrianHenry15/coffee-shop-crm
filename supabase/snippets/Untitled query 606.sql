SELECT
  o.slug,
  os.plan_id,
  os.status AS billing_status,
  os.stripe_subscription_status,
  os.stripe_price_id,
  sc.change_type,
  sc.status AS change_status,
  sc.stripe_invoice_id,
  sc.created_at
FROM public.organizations o
JOIN public.organization_subscriptions os
  ON os.organization_id = o.id
LEFT JOIN public.stripe_subscription_changes sc
  ON sc.organization_id = o.id
WHERE o.slug = 'YOUR_ORGANIZATION_SLUG'
ORDER BY sc.created_at DESC NULLS LAST
LIMIT 5;