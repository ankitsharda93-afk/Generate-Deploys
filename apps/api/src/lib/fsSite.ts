import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SheetRow } from "@sheet-to-pages/shared";
import { renderIndexHtml } from "./siteTemplate.js";

export async function writeStaticSite(outputDir: string, row: SheetRow) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "index.html"), renderIndexHtml(row), "utf8");
}

