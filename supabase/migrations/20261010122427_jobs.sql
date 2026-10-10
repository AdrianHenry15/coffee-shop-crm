
-- =========================================================
-- JOBS TABLE
-- =========================================================

create table public.jobs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  customer_id uuid not null,

  estimate_id uuid,

  title text not null
    check (length(trim(title)) between 1 and 200),

  description text,

  status text not null default 'scheduled'
    check (
      status in (
        'scheduled',
        'in_progress',
        'completed',
        'canceled'
      )
    ),

  scheduled_start timestamptz,
  scheduled_end timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_valid_schedule
    check (
      scheduled_start is null
      or scheduled_end is null
      or scheduled_end > scheduled_start
    ),

  constraint jobs_completed_at_consistent
    check (
      (status = 'completed' and completed_at is not null)
      or
      (status <> 'completed' and completed_at is null)
    ),

  constraint jobs_id_organization_unique
    unique (id, organization_id),

  constraint jobs_customer_same_organization
    foreign key (customer_id, organization_id)
    references public.customers(id, organization_id)
    on delete restrict,

  constraint jobs_estimate_same_organization
    foreign key (estimate_id, organization_id)
    references public.estimates(id, organization_id)
    on delete restrict
);

-- An estimate can produce at most one job.
create unique index jobs_estimate_unique
  on public.jobs(estimate_id)
  where estimate_id is not null;

create index jobs_organization_idx
  on public.jobs(organization_id);

create index jobs_customer_idx
  on public.jobs(organization_id, customer_id);

create index jobs_schedule_idx
  on public.jobs(organization_id, scheduled_start);

create index jobs_status_idx
  on public.jobs(organization_id, status);


-- =========================================================
-- VALIDATE LINKED ESTIMATE
-- =========================================================

create or replace function public.validate_job_estimate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_status text;
begin
  if new.estimate_id is null then
    return new;
  end if;

  select customer_id, status
  into v_customer_id, v_status
  from public.estimates
  where id = new.estimate_id
    and organization_id = new.organization_id;

  if not found then
    raise exception 'Estimate not found';
  end if;

  if v_customer_id <> new.customer_id then
    raise exception 'Estimate belongs to another customer';
  end if;

  if v_status <> 'accepted' then
    raise exception 'Only accepted estimates can be linked to jobs';
  end if;

  return new;
end;
$$;

create trigger jobs_validate_estimate
before insert or update of estimate_id, customer_id, organization_id
on public.jobs
for each row
execute function public.validate_job_estimate();


-- =========================================================
-- IMMUTABLE ORGANIZATION
-- =========================================================

create or replace function public.prevent_job_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Job organization cannot be changed';
  end if;

  return new;
end;
$$;

create trigger jobs_prevent_organization_change
before update of organization_id
on public.jobs
for each row
execute function public.prevent_job_organization_change();


-- =========================================================
-- COMPLETION TIMESTAMP
-- =========================================================

create or replace function public.set_job_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status <> 'completed' then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger jobs_set_completion
before insert or update of status
on public.jobs
for each row
execute function public.set_job_completion();


-- =========================================================
-- UPDATED_AT
-- =========================================================

-- Automatically update updated_at
create or replace function public.update_job_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jobs_updated_at
before update on public.jobs
for each row
execute function public.update_job_timestamp();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.jobs enable row level security;

create policy "Members can view jobs"
on public.jobs
for select
to authenticated
using (
  private.is_org_member(organization_id)
);

create policy "Members can create jobs"
on public.jobs
for insert
to authenticated
with check (
  private.is_org_member(organization_id)
);

create policy "Members can update jobs"
on public.jobs
for update
to authenticated
using (
  private.is_org_member(organization_id)
)
with check (
  private.is_org_member(organization_id)
);

create policy "Members can delete jobs"
on public.jobs
for delete
to authenticated
using (
  private.is_org_member(organization_id)
);

grant select, insert, update, delete
on public.jobs
to authenticated;
