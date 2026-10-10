create or replace function public.enforce_draft_estimate_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  estimate_status text;
begin
  -- Allow item deletion when its parent estimate is being deleted.
  -- Parent estimate deletion is separately protected by RLS/FKs.
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;

  select e.status
  into estimate_status
  from public.estimates e
  where e.id = case
    when tg_op = 'DELETE' then old.estimate_id
    else new.estimate_id
  end
  for update;

  if estimate_status is null then
    raise exception 'Estimate not found';
  end if;

  if estimate_status <> 'draft' then
    raise exception 'Estimate items can only be modified while draft';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;