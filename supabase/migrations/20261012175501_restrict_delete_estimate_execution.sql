-- Restrict estimate deletion to authenticated users.
-- Run as the function owner so privilege changes persist.

begin;

set local role estimate_deleter;

revoke execute
on function public.delete_estimate(uuid, uuid)
from public, anon, service_role;

grant execute
on function public.delete_estimate(uuid, uuid)
to authenticated;

commit;