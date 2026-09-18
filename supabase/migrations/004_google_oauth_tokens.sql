-- Store Google OAuth refresh tokens (server-side only).
-- Used to read private Google Sheets via Google Sheets API when CSV export is blocked (401/403).

create table if not exists public.google_oauth_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refresh_token text not null
);

-- Ensure helper function exists (some projects may not have run 001_init.sql yet)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-update updated_at
drop trigger if exists google_oauth_tokens_set_updated_at on public.google_oauth_tokens;
create trigger google_oauth_tokens_set_updated_at
before update on public.google_oauth_tokens
for each row execute function public.set_updated_at();

-- Lock down with RLS (no client policies; server uses service role key)
alter table public.google_oauth_tokens enable row level security;

