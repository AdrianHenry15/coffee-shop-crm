-- ============================================================
-- CoffeeShopCRM
-- Core tenant tables
-- ============================================================


-- ------------------------------------------------------------
-- Profiles
--
-- Extends Supabase auth.users with application-specific
-- information about a user.
-- ------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  first_name text,
  last_name text,
  avatar_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- Organizations
--
-- Represents a business/tenant using CoffeeShopCRM.
-- ------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- Organization Members
--
-- Junction table connecting users to organizations.
-- ------------------------------------------------------------

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member',
  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_members_organization_user_unique
    unique (organization_id, user_id)
);


-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

create index organization_members_organization_id_idx
  on public.organization_members(organization_id);

create index organization_members_user_id_idx
  on public.organization_members(user_id);