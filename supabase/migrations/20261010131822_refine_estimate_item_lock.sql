
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
  if tg_op = 'INSERT' then
    v_estimate_id := new.estimate_id;
  else
    v_estimate_id := old.estimate_id;
  end if;

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

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
