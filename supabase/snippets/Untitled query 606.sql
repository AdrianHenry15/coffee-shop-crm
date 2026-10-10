select
  l.id as lead_id,
  l.name as lead_name,
  l.status as lead_status,
  c.id as customer_id,
  c.name as customer_name,
  c.lead_id as customer_lead_id
from public.leads l
left join public.customers c
  on c.lead_id = l.id
  and c.organization_id = l.organization_id
order by l.created_at desc;