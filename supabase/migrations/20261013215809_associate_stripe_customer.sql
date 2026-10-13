create or replace function public.associate_stripe_customer(
  org_id uuid,
  customer_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_customer_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
  ) then
    raise exception 'Only an active organization owner can manage billing'
      using errcode = '42501';
  end if;

  if customer_id is null
    or customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'Invalid Stripe customer ID'
      using errcode = '22023';
  end if;

  select stripe_customer_id
  into existing_customer_id
  from public.organization_subscriptions
  where organization_id = org_id
  for update;

  if not found then
    raise exception 'Organization subscription not found'
      using errcode = 'P0001';
  end if;

  if existing_customer_id is not null then
    if existing_customer_id <> customer_id then
      raise exception 'Stripe customer already associated'
        using errcode = '23505';
    end if;

    return existing_customer_id;
  end if;

  update public.organization_subscriptions
  set stripe_customer_id = customer_id,
      updated_at = now()
  where organization_id = org_id;

  return customer_id;
end;
$$;

revoke all on function public.associate_stripe_customer(uuid, text)
from public, anon;

grant execute on function public.associate_stripe_customer(uuid, text)
to authenticated;