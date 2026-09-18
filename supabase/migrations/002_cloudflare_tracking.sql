-- Track Cloudflare Pages deployment details per generated site
alter table public.sites
  add column if not exists pages_project_name text;

alter table public.sites
  add column if not exists custom_hostname text;

