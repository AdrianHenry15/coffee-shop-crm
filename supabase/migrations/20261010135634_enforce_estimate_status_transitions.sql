
create or replace function public.enforce_estimate_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Allow updates that do not change the status.
  if new.status = old.status then
    return new;
  end if;

  -- Draft estimates can only be sent.
  if old.status = 'draft' and new.status = 'sent' then
    return new;
  end if;

  -- Sent estimates can be accepted or declined.
  if old.status = 'sent'
     and new.status in ('accepted', 'declined') then
    return new;
  end if;

  raise exception
    'Invalid estimate status transition: % to %',
    old.status,
    new.status
    using errcode = '23514';
end;
$$;

create trigger enforce_estimate_status_transition
before update of status
on public.estimates
for each row
execute function public.enforce_estimate_status_transition();
