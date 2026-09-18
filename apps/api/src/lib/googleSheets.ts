import { google } from "googleapis";

export type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

function parseServiceAccountJson(raw: string): ServiceAccountCreds {
  const trimmed = raw.trim();
  const jsonText =
    trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8").trim();
  const obj = JSON.parse(jsonText) as Partial<ServiceAccountCreds>;
  if (!obj.client_email || !obj.private_key) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON (missing client_email/private_key)");
  }
  return { client_email: obj.client_email, private_key: obj.private_key };
}

export function hasGoogleSheetsServiceAccount() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
}

export function getGoogleServiceAccountEmail(): string | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const creds = parseServiceAccountJson(raw);
    return creds.client_email;
  } catch {
    return null;
  }
}

export async function readSheetTableViaServiceAccount(args: {
  spreadsheetId: string;
  gid: string;
  maxRows?: number;
  maxCols?: number;
}): Promise<string[][]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
  const creds = parseServiceAccountJson(raw);

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const gidNum = Number(args.gid);
  const maxRows = args.maxRows ?? 1001; // header + 1000 rows
  const maxCols = args.maxCols ?? 60; // wide enough for most sheets

  // Find sheet title by gid; fall back to first tab.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const tabs = meta.data.sheets ?? [];
  const chosen =
    tabs.find((t) => t.properties?.sheetId === gidNum)?.properties ??
    tabs[0]?.properties ??
    null;

  if (!chosen?.title) throw new Error("Could not determine sheet tab title");

  // NOTE: A1 range. We fetch a generous rectangle and then trim empty tail rows.
  const range = `${chosen.title}!A1:${colIndexToA1(maxCols)}${maxRows}`;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: args.spreadsheetId,
    range,
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = (resp.data.values ?? []).map((row) => row.map((c) => String(c ?? "")));
  return values;
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function hasGoogleOAuthConfigured() {
  return Boolean(getOAuthConfig());
}

export function createGoogleOAuth2Client() {
  const cfg = getOAuthConfig();
  if (!cfg) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URL");
  }
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export async function readSheetTableViaUserRefreshToken(args: {
  spreadsheetId: string;
  gid: string;
  refreshToken: string;
  maxRows?: number;
  maxCols?: number;
}): Promise<string[][]> {
  const oauth2 = createGoogleOAuth2Client();
  oauth2.setCredentials({ refresh_token: args.refreshToken });

  const sheets = google.sheets({ version: "v4", auth: oauth2 });
  const gidNum = Number(args.gid);
  const maxRows = args.maxRows ?? 1001;
  const maxCols = args.maxCols ?? 60;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const tabs = meta.data.sheets ?? [];
  const chosen =
    tabs.find((t) => t.properties?.sheetId === gidNum)?.properties ??
    tabs[0]?.properties ??
    null;
  if (!chosen?.title) throw new Error("Could not determine sheet tab title");

  const range = `${chosen.title}!A1:${colIndexToA1(maxCols)}${maxRows}`;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: args.spreadsheetId,
    range,
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  return (resp.data.values ?? []).map((row) => row.map((c) => String(c ?? "")));
}

function colIndexToA1(n: number) {
  // 1 -> A, 26 -> Z, 27 -> AA, ...
  let num = n;
  let s = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

export async function readGoogleDocViaUserRefreshToken(args: {
  documentId: string;
  refreshToken: string;
}): Promise<{ title: string; body: string }> {
  const oauth2 = createGoogleOAuth2Client();
  oauth2.setCredentials({ refresh_token: args.refreshToken });

  const docs = google.docs({ version: "v1", auth: oauth2 });
  const resp = await docs.documents.get({
    documentId: args.documentId,
  });

  const doc = resp.data;
  const title = doc.title || "Untitled Document";
  let content = "";

  // Recursive parsing of the structural elements of a Google Doc.
  function parseElements(elements: any[]) {
    for (const el of elements) {
      if (el.paragraph) {
        let para = "";
        for (const child of el.paragraph.elements) {
          if (child.textRun && child.textRun.content) {
            para += child.textRun.content;
          }
        }
        content += `<p>${para}</p>\n`;
      } else if (el.table) {
        content += "<table>\n";
        for (const row of el.table.tableRows) {
          content += "  <tr>\n";
          for (const cell of row.tableCells) {
            content += "    <td>";
            parseElements(cell.content);
            content += "</td>\n";
          }
          content += "  </tr>\n";
        }
        content += "</table>\n";
      } else if (el.tableOfContents) {
        parseElements(el.tableOfContents.content);
      } else if (el.sectionBreak) {
        content += "<hr />\n";
      }
    }
  }

  if (doc.body && doc.body.content) {
    parseElements(doc.body.content);
  }

  return { title, body: content };
}

