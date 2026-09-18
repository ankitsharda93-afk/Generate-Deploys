import * as XLSX from "xlsx";
import { SheetRowSchema, type SheetRow } from "@sheet-to-pages/shared";
import {
  hasGoogleOAuthConfigured,
  hasGoogleSheetsServiceAccount,
  readSheetTableViaServiceAccount,
  readSheetTableViaUserRefreshToken,
} from "./googleSheets.js";
import { getUserGoogleRefreshToken } from "./googleOAuthTokens.js";

function normalizeHeaderKey(key: string) {
  return key.trim().toLowerCase();
}

function getAny(normalized: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = normalized[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function mapRow(normalized: Record<string, unknown>): SheetRow {
  const hasStandard =
    ["title", "description", "image", "content", "domain"].some((k) => normalized[k] !== undefined);

  if (hasStandard) {
    return SheetRowSchema.parse({
      domain: String(normalized["domain"] ?? ""),
      title: String(normalized["title"] ?? ""),
      description: String(normalized["description"] ?? ""),
      image: String(normalized["image"] ?? ""),
      content: String(normalized["content"] ?? ""),
    });
  }

  // Auto-detect "local service" sheets like:
  // Primary Keyword, Secondary keyword, Street Address, city, state/province, Zip code, Contact
  const primary = getAny(normalized, ["primary keyword", "primary_keyword", "primary"]);
  const secondary = getAny(normalized, ["secondary keyword", "secondary_keyword", "secondary"]);
  const street = getAny(normalized, ["street address", "street_address", "address"]);
  const city = getAny(normalized, ["city", "town"]);
  const state = getAny(normalized, ["state/province", "state", "province"]);
  const zip = getAny(normalized, ["zip code", "zipcode", "zip"]);
  const contact = getAny(normalized, ["contact", "phone", "phone number", "phonenumber"]);

  const service = secondary || primary || "Service";
  const location = [city, state].filter(Boolean).join(", ");
  const title = location ? `${service} in ${location}` : service;
  const description = location
    ? `Professional ${service} in ${location}. Call ${contact || "today"} for a free quote.`
    : `Professional ${service}. Call ${contact || "today"} for a free quote.`;

  const addressLine = [street, city, state, zip].filter(Boolean).join(", ");
  const content = `
    <p><b>${service}</b>${location ? ` in <b>${location}</b>` : ""}.</p>
    ${addressLine ? `<p><b>Address:</b> ${addressLine}</p>` : ""}
    ${contact ? `<p><b>Contact:</b> <a href="tel:${escapeHtmlForAttr(contact)}">${escapeHtml(contact)}</a></p>` : ""}
    <hr />
    <h3>Services</h3>
    <ul>
      ${primary ? `<li>${escapeHtml(primary)}</li>` : ""}
      ${secondary ? `<li>${escapeHtml(secondary)}</li>` : ""}
    </ul>
    <p>Generated from your spreadsheet row.</p>
  `.trim();

  const domain = toDomainSlug(`${service}-${city || state || ""}`) || "";

  return SheetRowSchema.parse({
    domain,
    title,
    description,
    image: "",
    content,
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlForAttr(s: string) {
  // for tel: href; keep only basic chars
  return s.replace(/[^0-9+()-\s]/g, "");
}

function toDomainSlug(s: string) {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return out;
}

export function parseWorkbookFirstSheet(buffer: Buffer): SheetRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: SheetRow[] = raw.map((r) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) normalized[normalizeHeaderKey(k)] = v;

    return mapRow(normalized);
  });

  return rows.filter((r) => r.title.trim().length > 0);
}

export async function parseGoogleSheetUrl(
  sheetUrl: string,
  opts?: { userId?: string },
): Promise<SheetRow[]> {
  // Supports:
  // - Standard link: https://docs.google.com/spreadsheets/d/<id>/edit#gid=0
  // - Direct CSV links (export/gviz)
  // - "Publish to web" links: https://docs.google.com/spreadsheets/d/e/<token>/pubhtml?... (we convert to CSV)
  const input = sheetUrl.trim();
  if (!input) throw new Error("Invalid Google Sheet URL");

  let parsed: URL | null = null;
  try {
    parsed = new URL(input);
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.hostname !== "docs.google.com") {
    throw new Error("Invalid Google Sheet URL (expected docs.google.com)");
  }

  const candidates: string[] = [];

  // If user already provided a direct CSV URL, try it first.
  if (/(\bformat=csv\b|\boutput=csv\b|\btqx=out:csv\b)/i.test(input)) {
    candidates.push(input);
  }

  const gidMatch = input.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch?.[1] ?? "0";

  // "Publish to web" links use /d/e/<token>/pubhtml
  const pubMatch = input.match(/\/spreadsheets\/d\/e\/([^/]+)/);
  if (pubMatch) {
    const u = new URL(input);
    // Normalize pubhtml -> pub and force output=csv
    u.pathname = u.pathname.replace(/\/pubhtml$/i, "/pub").replace(/\/pub$/i, "/pub");
    u.searchParams.set("output", "csv");
    if (!u.searchParams.get("gid")) u.searchParams.set("gid", gid);
    if (!u.searchParams.get("single")) u.searchParams.set("single", "true");
    candidates.push(u.toString());
  }

  // Standard doc links use /d/<id>/
  const match = input.match(/\/spreadsheets\/d\/([^/]+)/);
  if (match) {
    const id = match[1];
    // Try multiple endpoints; some org/workspace configs block /export but allow /gviz CSV.
    candidates.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`);
    candidates.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
  }

  if (candidates.length === 0) {
    throw new Error(
      "Invalid Google Sheet URL. Use the normal sheet link (…/spreadsheets/d/<id>/edit#gid=0) or a published CSV link.",
    );
  }

  let lastDenied: number | null = null;
  let lastHtml = false;
  let lastStatus: number | null = null;

  async function tryFetch(url: string) {
    const resp = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "text/csv,text/plain,*/*",
      },
    });
    lastStatus = resp.status;
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) lastDenied = resp.status;
      return null;
    }
    const text = await resp.text();
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("text/html") || /<html[\s>]/i.test(text)) {
      lastHtml = true;
      return null;
    }
    return text;
  }

  let csv: string | null = null;
  for (const url of candidates) {
    csv = await tryFetch(url);
    if (csv) break;
  }

  if (!csv) {
    // Fallback A: user OAuth (best UX: user connects Google once; supports private sheets)
    if (lastDenied && opts?.userId && hasGoogleOAuthConfigured() && match) {
      const spreadsheetId = match[1];
      const refresh = await getUserGoogleRefreshToken(opts.userId);
      if (refresh) {
        try {
          const table = await readSheetTableViaUserRefreshToken({
            spreadsheetId,
            gid,
            refreshToken: refresh,
            maxRows: 1001,
            maxCols: 80,
          });
          return tabularToRows(table);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Google OAuth sheet read failed";
          throw new Error(`${msg}. Try reconnecting Google in the dashboard.`);
        }
      }
    }

    // Fallback B: service account (requires sharing the sheet with the service account email)
    if (lastDenied && hasGoogleSheetsServiceAccount() && match) {
      const spreadsheetId = match[1];
      try {
        const table = await readSheetTableViaServiceAccount({ spreadsheetId, gid, maxRows: 1001, maxCols: 80 });
        return tabularToRows(table);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sheets API fallback failed";
        throw new Error(`${msg}. Also ensure you shared the sheet with the service account email.`);
      }
    }

    if (lastDenied) {
      throw new Error(
        `Google Sheet access denied (${lastDenied}). Connect Google Sheets in the dashboard (recommended), or publish the sheet to web / upload .xlsx.`,
      );
    }
    if (lastHtml) {
      throw new Error(
        "Google Sheet returned HTML instead of CSV. Make sure the sheet is public (Anyone-with-link Viewer) or use 'Publish to web' CSV link.",
      );
    }
    throw new Error(`Failed to fetch sheet CSV export (${lastStatus ?? "unknown"})`);
  }

  const wb = XLSX.read(csv, { type: "string" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: SheetRow[] = raw.map((r) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) normalized[normalizeHeaderKey(k)] = v;

    return mapRow(normalized);
  });

  return rows.filter((r) => r.title.trim().length > 0);
}

function tabularToRows(table: string[][]): SheetRow[] {
  if (table.length === 0) return [];
  const headers = (table[0] ?? []).map((h) => normalizeHeaderKey(String(h ?? "")));
  const out: SheetRow[] = [];
  for (const row of table.slice(1)) {
    const normalized: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      normalized[key] = row[i] ?? "";
    }
    const mapped = mapRow(normalized);
    if (mapped.title.trim().length > 0) out.push(mapped);
  }
  return out;
}

