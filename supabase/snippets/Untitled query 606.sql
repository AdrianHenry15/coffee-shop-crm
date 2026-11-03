SELECT
  namespace.nspname AS schema_name,
  procedure.proname AS function_name,
  pg_get_userbyid(procedure.proowner) AS function_owner,
  procedure.prosecdef AS security_definer,
  pg_get_functiondef(procedure.oid) AS definition
FROM pg_proc AS procedure
JOIN pg_namespace AS namespace
  ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname IN ('public', 'private')
  AND procedure.prokind = 'f'
  AND (
    (
      (
        procedure.prosecdef
        OR pg_get_userbyid(procedure.proowner) = 'estimate_deleter'
      )
      AND procedure.prosrc ~*
        '\m(leads|customers|estimates|estimate_items|jobs)\M'
      AND procedure.proname NOT IN (
        'enforce_subscription_limit',
        'get_effective_subscription_limit'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger
      JOIN pg_class AS relation
        ON relation.oid = trigger.tgrelid
      JOIN pg_namespace AS table_namespace
        ON table_namespace.oid = relation.relnamespace
      WHERE trigger.tgfoid = procedure.oid
        AND NOT trigger.tgisinternal
        AND table_namespace.nspname = 'public'
        AND relation.relname IN ('leads', 'customers')
    )
  )
ORDER BY namespace.nspname, procedure.proname;