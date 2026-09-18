-- Store quote/lead requests submitted from generated sites
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_url text,
  service text,
  city text,
  name text,
  phone text,
  message text,
  user_agent text,
  ip text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

