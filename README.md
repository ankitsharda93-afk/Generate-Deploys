## Sheet → Static Sites → Cloudflare Pages (Bulk)

Full-stack app that lets a user upload an **Excel/CSV** (or import a **Google Sheet**) containing website data and automatically:

- Parses up to **100 rows**
- Generates **one static site per row** from a template
- Deploys each site to **Cloudflare Pages via API**
- Shows **progress + URLs** in a simple **Next.js dashboard**

### Stack

- **Frontend**: Next.js (App Router)
- **Backend**: Node.js (Express API)
- **Database/Auth**: Supabase
- **Deploy**: Cloudflare Pages API
- **Parsing**: `xlsx` (Excel/CSV)

---

## Project structure

```
apps/
  web/                 # Next.js dashboard UI
  api/                 # Node/Express API for parsing, generation, deployment
packages/
  shared/              # Shared types and helpers (optional, minimal)
supabase/
  migrations/          # SQL you apply to Supabase
```

---

## Setup

### 1) Prereqs

- Node.js **18+** (recommended 20 LTS)
- A Supabase project (URL + anon key + service role key)
- A Cloudflare account with Pages enabled
- Cloudflare API token with **Pages + DNS** permissions (recommended: scoped token)
- (Optional) A domain in Cloudflare for custom subdomains (e.g. `appdomain.com`)

### 2) Install

From repo root:

```bash
npm install
```

### 3) Environment variables

Create:

- `apps/api/.env`
- `apps/web/.env.local`

See the templates:

- `apps/api/env.example`
- `apps/web/env.example`

### 4) Supabase schema

Apply SQL in `supabase/migrations/` to your Supabase project (via SQL editor).

### Optional: Private Google Sheets (best UX)

Google Sheets links can return **401** for private / Google Workspace-restricted sheets. To support **any sheet URL** (that the user can access), configure **Google OAuth** once and the dashboard will show a **Connect Google** button.

- **Supabase migration**: apply `supabase/migrations/004_google_oauth_tokens.sql`
- **API env vars** (in `apps/api/.env`):
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URL` (local: `http://localhost:4000/v1/google/callback`)
  - `GOOGLE_OAUTH_STATE_SECRET` (any long random string)

In Google Cloud Console:
- Enable **Google Sheets API**
- Create **OAuth Client (Web)**
- Add **Authorized redirect URI**: `http://localhost:4000/v1/google/callback`

After setup, open the dashboard and click **Connect Google** once. Then **Generate & Deploy** works for private Google Sheet URLs too.

### 5) Run locally

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

---

## Input format (sheet columns)

Required columns (header row):

- `domain` (optional if you want auto naming; used for subdomain slug)
- `title`
- `description`
- `image` (URL)
- `content` (long text / HTML allowed)

Each row becomes one generated site.

---

## Cloudflare Pages behavior

- **Deploy**: each row deploys to a **unique Pages project** (name derived from job + row).
- **Default URL**: Cloudflare returns `https://<project>.pages.dev`.
- **Custom subdomain (optional)**: if you set `BASE_DOMAIN` + `CLOUDFLARE_ZONE_ID`, the API will:
  - Create/Update a **CNAME** like `site1.appdomain.com` → `<project>.pages.dev`
  - Call the Pages **custom domain** API to attach `site1.appdomain.com` to that Pages project

---

## Notes / limits

- Bulk operations are rate-limited with small concurrency and retries.
- Max 100 rows per job (hard cap).

