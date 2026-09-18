import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { parseGoogleSheetUrl, parseWorkbookFirstSheet } from "../lib/sheetParse.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const previewRouter = Router();

const PreviewSchema = z.object({
  sheetUrl: z.string().url().optional(),
});

previewRouter.post("/", upload.single("file"), async (req, res) => {
  const parsed = PreviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const file = req.file;
  const sheetUrl = parsed.data.sheetUrl?.trim();
  if (!file && !sheetUrl) return res.status(400).json({ error: "Provide a file or sheetUrl" });

  try {
    const rows = file ? parseWorkbookFirstSheet(file.buffer) : await parseGoogleSheetUrl(sheetUrl!);
    return res.json({
      ok: true,
      rowCount: rows.length,
      sample: rows.slice(0, 3),
      warning: rows.length > 100 ? "Max 100 websites per job (extra rows will be rejected)." : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Preview failed";
    return res.status(400).json({ ok: false, error: msg });
  }
});

