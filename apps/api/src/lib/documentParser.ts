import { PDFParse } from "pdf-parse";
import { type SheetRow } from "@sheet-to-pages/shared";
import { readGoogleDocViaUserRefreshToken } from "./googleSheets.js";
import { getUserGoogleRefreshToken } from "./googleOAuthTokens.js";

export async function parsePdfBuffer(buffer: Buffer, filename?: string): Promise<SheetRow[]> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const title = filename?.replace(".pdf", "") || "PDF Document";
    const content = result.text.split("\n").map(line => `<p>${line}</p>`).join("\n");

    return [{
      domain: toSlug(title),
      title: title,
      description: `Generated from PDF: ${title}`,
      image: "",
      content: content,
    }];
  } catch (e) {
    console.error("PDF Parse error:", e);
    throw new Error("Failed to parse PDF document. It might be encrypted or corrupted.");
  }
}

export async function parseGoogleDocUrl(
  url: string,
  opts: { userId: string }
): Promise<SheetRow[]> {
  const match = url.match(/\/document\/d\/([^/]+)/);
  if (!match) return [];
  
  const documentId = match[1];
  const refreshToken = await getUserGoogleRefreshToken(opts.userId);
  if (!refreshToken) {
    throw new Error("Google not connected. Try reconnecting Google in the dashboard.");
  }

  try {
    const { title, body } = await readGoogleDocViaUserRefreshToken({
      documentId,
      refreshToken
    });

    return [{
      domain: toSlug(title),
      title: title,
      description: `Seamlessly generated from Google Doc: ${title}`,
      image: "",
      content: body,
    }];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to read Google Doc";
    throw new Error(`${msg}. Ensure the document is shared or reconnect Google.`);
  }
}

function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
