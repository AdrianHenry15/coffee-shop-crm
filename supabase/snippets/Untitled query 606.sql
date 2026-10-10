select
  p.proname,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as configuration
from pg_proc p
where p.oid = 'public.delete_estimate(uuid,uuid)'::regprocedure;