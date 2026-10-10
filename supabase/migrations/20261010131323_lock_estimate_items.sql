
create or replace function public.enforce_draft_estimate_items()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_estimate_id uuid;
  v_status text;
begin
  -- INSERT uses NEW; DELETE uses OLD.
  if tg_op = 'INSERT' then
    v_estimate_id := new.estimate_id;
  else
    v_estimate_id := old.estimate_id;
  end if;

  -- Lock the parent estimate to prevent concurrent status changes.
  select status
  into v_status
  from public.estimates
  where id = v_estimate_id
  for update;

  if v_status is null then
    raise exception 'Estimate not found';
  end if;

  if v_status <> 'draft' then
    raise exception
      'Estimate items can only be changed while the estimate is a draft';
  end if;

  -- Prevent moving an item to another estimate.
  if tg_op = 'UPDATE'
     and new.estimate_id is distinct from old.estimate_id then
    raise exception 'Cannot change an item estimate';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger enforce_draft_estimate_items
before insert or update or delete
on public.estimate_items
for each row
execute function public.enforce_draft_estimate_items();
