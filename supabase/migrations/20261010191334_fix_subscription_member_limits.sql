-- Remove the old INSERT trigger.
drop trigger if exists enforce_member_limit
on public.organization_members;

-- Active members count toward the subscription limit.
create trigger enforce_member_insert_limit
before insert on public.organization_members
for each row
when (new.status = 'active')
execute function private.enforce_subscription_limit();

-- Activating an inactive member also checks the limit.
create trigger enforce_member_activation_limit
before update of status on public.organization_members
for each row
when (
  old.status is distinct from 'active'
  and new.status = 'active'
)
execute function private.enforce_subscription_limit();