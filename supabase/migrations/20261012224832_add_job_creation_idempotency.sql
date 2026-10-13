alter table public.jobs
  add column creation_request_id uuid;

create unique index jobs_creation_request_unique
  on public.jobs(organization_id, creation_request_id)
  where creation_request_id is not null;