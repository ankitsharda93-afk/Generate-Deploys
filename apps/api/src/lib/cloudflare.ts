import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DeployResult = { url: string };

async function cfFetch(path: string, init?: RequestInit) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");

  const resp = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.errors?.[0]?.message ?? `Cloudflare API error (${resp.status})`);
  }
  return json;
}

export async function ensurePagesCustomDomain(opts: { projectName: string; hostname: string }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID");

  // Cloudflare Pages custom domains endpoint.
  // Docs URL shifts; this matches the common API shape:
  // POST /accounts/:account_id/pages/projects/:project/domains  { name: "<hostname>" }
  await cfFetch(`/accounts/${accountId}/pages/projects/${opts.projectName}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: opts.hostname }),
  });
}

export async function upsertCnameRecord(opts: { zoneId: string; name: string; content: string }) {
  // Create/update a CNAME: <name> -> <content>
  const list = await cfFetch(
    `/zones/${opts.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(opts.name)}`,
    { method: "GET", headers: { "Content-Type": "application/json" } },
  );

  const existing = Array.isArray(list?.result) ? list.result[0] : null;
  const payload = {
    type: "CNAME",
    name: opts.name,
    content: opts.content,
    proxied: true,
    ttl: 1,
  };

  if (existing?.id) {
    await cfFetch(`/zones/${opts.zoneId}/dns_records/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return;
  }

  await cfFetch(`/zones/${opts.zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Deploy a static directory to Cloudflare Pages.
 *
 * NOTE:
 * - Cloudflare Pages has an API for direct uploads, but the exact upload protocol
 *   changes over time. To keep local/dev flows reliable, this implementation uses
 *   Wrangler CLI (which calls the Cloudflare APIs).
 * - You still provide CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in env; Wrangler uses them.
 */
export async function deployWithWrangler(opts: {
  projectName: string;
  directory: string;
  customHostname?: string;
}): Promise<DeployResult> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token) throw new Error("Missing CLOUDFLARE_API_TOKEN");
  if (!accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID");

  const envOpts = {
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: token,
      CLOUDFLARE_ACCOUNT_ID: accountId,
    },
  };

  // Ensure the project exists before deploying
  try {
    await execFileAsync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["wrangler", "pages", "project", "create", opts.projectName, "--production-branch", "main"],
      envOpts
    );
  } catch (err: any) {
    if (err?.message?.includes("limit of projects")) {
      throw new Error("Cloudflare Project Limit Reached: Please delete old projects in your Cloudflare dashboard under 'Workers & Pages' to make room for new ones.");
    }
    // Ignore error if project already exists
    if (!err?.message?.includes("already exists")) {
      console.warn("Project creation warning (may already exist):", err?.message);
    }
  }

  // Requires user to have `wrangler` installed (dev dependency or global).
  // We keep it simple: run `npx wrangler pages deploy <dir> --project-name <name>`.
  const { stdout } = await execFileAsync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "wrangler", "pages", "deploy", opts.directory, "--project-name", opts.projectName, "--branch", "main"],
    envOpts
  );

  // We explicitly construct the production URL to avoid SSL delays with preview URLs.
  const productionUrl = `https://${opts.projectName}.pages.dev`;

  // Optional: map a custom subdomain (requires the base domain to be in your Cloudflare account)
  if (opts.customHostname) {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    if (!zoneId) throw new Error("Missing CLOUDFLARE_ZONE_ID (needed for customHostname)");

    const pagesDevHost = `${opts.projectName}.pages.dev`;
    await upsertCnameRecord({ zoneId, name: opts.customHostname, content: pagesDevHost });
    await ensurePagesCustomDomain({ projectName: opts.projectName, hostname: opts.customHostname });
    return { url: `https://${opts.customHostname}` };
  }

  return { url: productionUrl };
}

