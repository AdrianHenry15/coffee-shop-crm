select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'organization_members',
    'customers',
    'leads',
    'estimates',
    'jobs'
  )
  and cmd in ('UPDATE', 'ALL')
order by tablename, policyname;