
-- Create an estimate and its items in one transaction.
create or replace function public.create_estimate(
  p_organization_id uuid,
  p_customer_id uuid,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_estimate_id uuid;
  v_item jsonb;
  v_position integer := 0;
  v_quantity integer;
  v_price bigint;
  v_description text;
  v_total numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_org_member(p_organization_id) then
    raise exception 'Organization access denied';
  end if;

  if not exists (
    select 1
    from public.customers
    where id = p_customer_id
      and organization_id = p_organization_id
  ) then
    raise exception 'Customer not found';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Estimate requires 1 to 100 items';
  end if;

  -- Validate everything before inserting.
  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item->'description') is distinct from 'string'
       or jsonb_typeof(v_item->'quantity') is distinct from 'number'
       or jsonb_typeof(v_item->'unitPriceCents') is distinct from 'number'
       or (v_item->>'quantity') !~ '^[0-9]+$'
       or (v_item->>'unitPriceCents') !~ '^[0-9]+$'
    then
      raise exception 'Invalid estimate item';
    end if;

    v_description := trim(v_item->>'description');

    if length(v_description) not between 1 and 500 then
      raise exception 'Invalid item description';
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unitPriceCents')::bigint;

    if v_quantity <= 0 or v_price < 0 then
      raise exception 'Invalid quantity or price';
    end if;

    v_total := v_total + v_quantity::numeric * v_price;

    if v_total > 9223372036854775807 then
      raise exception 'Estimate total exceeds supported range';
    end if;
  end loop;

  insert into public.estimates (
    organization_id,
    customer_id,
    notes,
    status
  )
  values (
    p_organization_id,
    p_customer_id,
    nullif(trim(p_notes), ''),
    'draft'
  )
  returning id into v_estimate_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    insert into public.estimate_items (
      organization_id,
      estimate_id,
      position,
      description,
      quantity,
      unit_price_cents
    )
    values (
      p_organization_id,
      v_estimate_id,
      v_position,
      trim(v_item->>'description'),
      (v_item->>'quantity')::integer,
      (v_item->>'unitPriceCents')::bigint
    );

    v_position := v_position + 1;
  end loop;

  return v_estimate_id;
end;
$$;

revoke all on function public.create_estimate(
  uuid, uuid, text, jsonb
) from public, anon;

grant execute on function public.create_estimate(
  uuid, uuid, text, jsonb
) to authenticated;


-- Replace the items of an existing draft atomically.
create or replace function public.update_estimate_items(
  p_organization_id uuid,
  p_estimate_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer := 0;
  v_quantity integer;
  v_price bigint;
  v_description text;
  v_total numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_org_member(p_organization_id) then
    raise exception 'Organization access denied';
  end if;

  -- Lock the estimate to serialize concurrent edits.
  perform 1
  from public.estimates
  where id = p_estimate_id
    and organization_id = p_organization_id
    and status = 'draft'
  for update;

  if not found then
    raise exception 'Draft estimate not found';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Estimate requires 1 to 100 items';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item->'description') is distinct from 'string'
       or jsonb_typeof(v_item->'quantity') is distinct from 'number'
       or jsonb_typeof(v_item->'unitPriceCents') is distinct from 'number'
       or (v_item->>'quantity') !~ '^[0-9]+$'
       or (v_item->>'unitPriceCents') !~ '^[0-9]+$'
    then
      raise exception 'Invalid estimate item';
    end if;

    v_description := trim(v_item->>'description');

    if length(v_description) not between 1 and 500 then
      raise exception 'Invalid item description';
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unitPriceCents')::bigint;

    if v_quantity <= 0 or v_price < 0 then
      raise exception 'Invalid quantity or price';
    end if;

    v_total := v_total + v_quantity::numeric * v_price;

    if v_total > 9223372036854775807 then
      raise exception 'Estimate total exceeds supported range';
    end if;
  end loop;

  -- Both operations run inside the same transaction.
  delete from public.estimate_items
  where estimate_id = p_estimate_id
    and organization_id = p_organization_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    insert into public.estimate_items (
      organization_id,
      estimate_id,
      position,
      description,
      quantity,
      unit_price_cents
    )
    values (
      p_organization_id,
      p_estimate_id,
      v_position,
      trim(v_item->>'description'),
      (v_item->>'quantity')::integer,
      (v_item->>'unitPriceCents')::bigint
    );

    v_position := v_position + 1;
  end loop;

  update public.estimates
  set updated_at = now()
  where id = p_estimate_id
    and organization_id = p_organization_id;
end;
$$;

revoke all on function public.update_estimate_items(
  uuid, uuid, jsonb
) from public, anon;

grant execute on function public.update_estimate_items(
  uuid, uuid, jsonb
) to authenticated;
