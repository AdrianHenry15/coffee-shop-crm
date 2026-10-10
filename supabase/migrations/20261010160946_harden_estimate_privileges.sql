-- Remove table access from anonymous users.
revoke all privileges
on table public.estimates, public.estimate_items
from anon;

-- Remove privileges unnecessary for normal CRM operations.
revoke truncate, trigger, references
on table public.estimates, public.estimate_items
from authenticated;

-- Preserve normal authenticated CRUD.
grant select, insert, update, delete
on table public.estimates, public.estimate_items
to authenticated;