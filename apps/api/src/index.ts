import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from the same folder as index.ts (src) parent (root of apps/api)
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });
import cors from "cors";
import express from "express";
import { requireUser } from "./middleware/requireUser.js";
import { jobsRouter } from "./routes/jobs.js";
import { configRouter } from "./routes/config.js";
import { leadsRouter } from "./routes/leads.js";
import { previewRouter } from "./routes/preview.js";
import { googleRouter } from "./routes/google.js";
import { seoRouter } from "./routes/seo.js";

const app = express();

app.use(
  cors({
    // Allow generated sites (pages.dev or custom domains) to POST leads.
    // Jobs endpoints are still protected by Bearer tokens.
    origin: (_origin, cb) => cb(null, true),
    credentials: false,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.send("Generate Deploys API is running!");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1/config", configRouter);
app.use("/v1/preview", previewRouter);
app.use("/v1/google", googleRouter);
app.use("/v1/seo", seoRouter);
app.use("/v1/leads", leadsRouter);
app.use("/v1/jobs", requireUser, jobsRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});

