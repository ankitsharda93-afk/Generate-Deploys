-- Enable extensions
create extension if not exists pgcrypto;

-- Jobs represent one uploaded sheet import + bulk generation/deploy run.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('queued','parsing','generating','deploying','completed','failed')),
  message text,
  total_sites int not null default 0,
  generated_sites int not null default 0,
  deployed_sites int not null default 0
);

create index if not exists jobs_user_id_created_at_idx on public.jobs (user_id, created_at desc);

-- Sites are one row => one generated website + one deployment.
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  row_index int not null,
  domain text,
  title text not null,
  description text,
  image text,
  status text not null check (status in ('queued','generated','deployed','failed')),
  url text,
  error text
);

create unique index if not exists sites_job_row_unique on public.sites (job_id, row_index);
create index if not exists sites_user_id_created_at_idx on public.sites (user_id, created_at desc);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- RLS
alter table public.jobs enable row level security;
alter table public.sites enable row level security;

-- Jobs: users can read their own jobs
drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own"
on public.jobs
for select
to authenticated
using (auth.uid() = user_id);

-- Sites: users can read their own sites
drop policy if exists "sites_select_own" on public.sites;
create policy "sites_select_own"
on public.sites
for select
to authenticated
using (auth.uid() = user_id);

