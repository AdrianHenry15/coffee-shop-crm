SELECT
  'policy' AS definition_type,
  policyname AS name,
  jsonb_build_object(
    'command', cmd,
    'roles', roles,
    'using', qual,
    'check', with_check
  )::text AS definition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'organization_members'

UNION ALL

SELECT
  'trigger',
  trigger.tgname,
  pg_get_triggerdef(trigger.oid)
FROM pg_trigger AS trigger
WHERE trigger.tgrelid =
  'public.organization_members'::regclass
  AND NOT trigger.tgisinternal;