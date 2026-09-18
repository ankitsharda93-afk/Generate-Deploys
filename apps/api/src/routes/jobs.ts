import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import pLimit from "p-limit";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/requireUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { parseGoogleSheetUrl, parseWorkbookFirstSheet } from "../lib/sheetParse.js";
import { parsePdfBuffer, parseGoogleDocUrl } from "../lib/documentParser.js";
import { writeStaticSite } from "../lib/fsSite.js";
import { deployWithWrangler } from "../lib/cloudflare.js";
import { toSlug } from "../lib/slug.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const jobsRouter = Router();

const OFFLINE_STATE = {
  jobs: [] as any[],
  sites: [] as any[],
};

jobsRouter.get("/", async (req, res) => {
  const userId = (req as unknown as AuthedRequest).userId;
  if (userId === "offline-user-id") {
    return res.json({ jobs: OFFLINE_STATE.jobs.filter(j => j.user_id === userId).reverse().slice(0, 25) });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return res.status(500).json({ error: msg });
  }
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ jobs: data ?? [] });
});

jobsRouter.get("/:jobId", async (req, res) => {
  const userId = (req as unknown as AuthedRequest).userId;
  const jobId = req.params.jobId;

  if (userId === "offline-user-id") {
    const job = OFFLINE_STATE.jobs.find((j) => j.id === jobId && j.user_id === userId);
    if (!job) return res.status(404).json({ error: "Not found" });
    const sites = OFFLINE_STATE.sites.filter((s) => s.job_id === jobId);
    return res.json({ job, sites });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return res.status(500).json({ error: msg });
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (jobErr) return res.status(500).json({ error: jobErr.message });
  if (!job) return res.status(404).json({ error: "Not found" });

  const { data: sites, error: sitesErr } = await supabaseAdmin
    .from("sites")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("row_index", { ascending: true });
  if (sitesErr) return res.status(500).json({ error: sitesErr.message });

  return res.json({ job, sites: sites ?? [] });
});

jobsRouter.delete("/:jobId", async (req, res) => {
  const userId = (req as unknown as AuthedRequest).userId;
  const jobId = req.params.jobId;

  if (userId === "offline-user-id") {
    OFFLINE_STATE.jobs = OFFLINE_STATE.jobs.filter((j) => j.id !== jobId);
    OFFLINE_STATE.sites = OFFLINE_STATE.sites.filter((s) => s.job_id !== jobId);
    return res.json({ success: true });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  // Delete sites first
  await supabaseAdmin.from("sites").delete().eq("job_id", jobId).eq("user_id", userId);
  // Then delete job
  const { error } = await supabaseAdmin.from("jobs").delete().eq("id", jobId).eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

const CreateJobSchema = z.object({
  sheetUrl: z.string().url().optional(),
});

jobsRouter.post("/create", upload.single("file"), async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return res.status(500).json({ error: msg });
  }
  const userId = (req as unknown as AuthedRequest).userId;
  const parsed = CreateJobSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const file = req.file;
  const sheetUrl = parsed.data.sheetUrl?.trim();
  if (!file && !sheetUrl) return res.status(400).json({ error: "Provide a file or sheetUrl" });

  let rows;
  try {
    const isPdf = file?.originalname?.toLowerCase()?.endsWith(".pdf");
    const isDocUrl = sheetUrl?.toLowerCase()?.includes("/document/d/");

    if (isPdf && file) {
      rows = await parsePdfBuffer(file.buffer, file.originalname);
    } else if (isDocUrl && sheetUrl) {
      if (!userId) throw new Error("Connection session expired; sign in again.");
      rows = await parseGoogleDocUrl(sheetUrl, { userId });
    } else if (file) {
      rows = parseWorkbookFirstSheet(file.buffer);
    } else if (sheetUrl) {
      rows = await parseGoogleSheetUrl(sheetUrl, { userId });
    } else {
      throw new Error("Provide a file or URL to generate content.");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parsing strategy failed for modern document.";
    return res.status(400).json({ error: msg });
  }

  if (rows.length === 0) return res.status(400).json({ error: "No rows found" });
  if (rows.length > 100) return res.status(400).json({ error: "Max 100 websites per sheet" });

  if (userId === "offline-user-id") {
    const jobId = `offline-job-${Date.now()}`;
    OFFLINE_STATE.jobs.push({
      id: jobId, user_id: userId, status: "completed", message: "Simulation Completed",
      total_sites: rows.length, generated_sites: rows.length, deployed_sites: rows.length,
      created_at: new Date().toISOString()
    });
    rows.forEach((r, i) => {
      OFFLINE_STATE.sites.push({
        id: `offline-site-${jobId}-${i}`,
        job_id: jobId, user_id: userId, row_index: i + 1,
        title: r.title || `Mock Site ${i + 1}`,
        status: "deployed", url: `https://${toSlug(r.title || `mock-site-${i + 1}`)}.simulation.local`
      });
    });
    return res.json({ jobId });
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .insert({
      user_id: userId,
      status: "queued",
      message: "Queued",
      total_sites: rows.length,
      generated_sites: 0,
      deployed_sites: 0,
    })
    .select("*")
    .single();
  if (jobErr) return res.status(500).json({ error: jobErr.message });

  const sitesPayload = rows.map((r, i) => ({
    job_id: job.id,
    user_id: userId,
    row_index: i + 1,
    domain: r.domain || null,
    title: r.title,
    description: r.description || null,
    image: r.image || null,
    status: "queued",
  }));
  const { error: sitesErr } = await supabaseAdmin.from("sites").insert(sitesPayload);
  if (sitesErr) return res.status(500).json({ error: sitesErr.message });

  // Fire-and-forget background processing
  void processJob({ jobId: job.id, userId, rows });

  return res.json({ jobId: job.id });
});

async function processJob(opts: { jobId: string; userId: string; rows: Array<any> }) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    // If Supabase isn't configured, we can't persist status anyway.
    return;
  }
  const { jobId, userId, rows } = opts;
  const baseDir = path.join(process.cwd(), ".data", "jobs", jobId);

  const limit = pLimit(3);
  let generated = 0;
  let deployed = 0;

  try {
    await mkdir(baseDir, { recursive: true });
    await supabaseAdmin.from("jobs").update({ status: "generating", message: "Generating sites…" }).eq("id", jobId);
    console.log(`[Job ${jobId}] Starting generation phase for ${rows.length} sites...`);

    // Generate all sites (small concurrency)
    await Promise.all(
      rows.map((row: any, idx: number) =>
        limit(async () => {
          const rowIndex = idx + 1;
          try {
            console.log(`[Job ${jobId}] Generating site ${rowIndex}...`);
            const outDir = path.join(baseDir, `site-${rowIndex}`);
            await writeStaticSite(outDir, row);
            generated += 1;
            await supabaseAdmin
              .from("sites")
              .update({ status: "generated" })
              .eq("job_id", jobId)
              .eq("user_id", userId)
              .eq("row_index", rowIndex);
            console.log(`[Job ${jobId}] Site ${rowIndex} generated locally.`);
            await supabaseAdmin
              .from("jobs")
              .update({ generated_sites: generated, status: "generating", message: `Generated ${generated}/${rows.length}` })
              .eq("id", jobId);
          } catch (siteErr: any) {
            console.error(`[Job ${jobId}] Site ${rowIndex} generation failed:`, siteErr);
            throw siteErr; // Still throw to fail the overall Promise.all if needed
          }
        }),
      ),
    );

    await supabaseAdmin.from("jobs").update({ status: "deploying", message: "Deploying to Cloudflare Pages…" }).eq("id", jobId);
    console.log(`[Job ${jobId}] Generation finished. Starting deployment phase...`);

    // Deploy each site (lower concurrency to avoid API limits)
    const deployLimit = pLimit(1);
    await Promise.all(
      rows.map((row: any, idx: number) =>
        deployLimit(async () => {
          // Add a larger delay between each deployment to satisfy Cloudflare rate limits
          await new Promise(r => setTimeout(r, 5000));
          
          const rowIndex = idx + 1;
          const desired = row.domain?.trim() ? String(row.domain).trim() : `site${rowIndex}`;
          const slug = toSlug(desired) || `site${rowIndex}`;
          const projectName = `job-${jobId.slice(0, 8)}-${slug}`.slice(0, 58); // CF limits are tight; keep short
          const baseDomain = process.env.BASE_DOMAIN?.trim();
          const customHostname = baseDomain ? `${slug}.${baseDomain}` : undefined;

          const outDir = path.join(baseDir, `site-${rowIndex}`);
          await supabaseAdmin
            .from("sites")
            .update({ pages_project_name: projectName, custom_hostname: customHostname ?? null })
            .eq("job_id", jobId)
            .eq("user_id", userId)
            .eq("row_index", rowIndex);
          
          console.log(`[Job ${jobId}] Deploying site ${rowIndex} to CF project: ${projectName}...`);
          const { url } = await deployWithWrangler({ projectName, directory: outDir, customHostname });
          console.log(`[Job ${jobId}] Site ${rowIndex} deployed successfully: ${url}`);

          // Try updating with all columns; if the DB is missing the new ones from migrations, fallback to basic update.
          const updatePayload: any = { 
            status: "deployed", 
            url, 
            pages_project_name: projectName, 
            custom_hostname: customHostname ?? null 
          };
          
          let { error: updErr } = await supabaseAdmin
            .from("sites")
            .update(updatePayload)
            .eq("job_id", jobId)
            .eq("user_id", userId)
            .eq("row_index", rowIndex);
          
          if (updErr && (updErr.message.includes("custom_hostname") || updErr.message.includes("pages_project_name"))) {
            console.warn(`[Job ${jobId}] Missing columns in 'sites' table. Attempting fallback update without Cloudflare tracking columns.`);
            const fallbackPayload = { status: "deployed", url };
            const { error: fallbackErr } = await supabaseAdmin
              .from("sites")
              .update(fallbackPayload)
              .eq("job_id", jobId)
              .eq("user_id", userId)
              .eq("row_index", rowIndex);
            updErr = fallbackErr;
          }
          
          if (updErr) {
            console.error(`[Job ${jobId}] Site ${rowIndex} update failed:`, updErr.message);
          } else {
            deployed += 1;
            await supabaseAdmin
              .from("jobs")
              .update({ deployed_sites: deployed, status: "deploying", message: `Deployed ${deployed}/${rows.length}` })
              .eq("id", jobId);
          }
        }).catch(async (e) => {
          const rowIndex = idx + 1;
          const msg = e instanceof Error ? e.message : "Deploy failed";
          await supabaseAdmin
            .from("sites")
            .update({ status: "failed", error: msg })
            .eq("job_id", jobId)
            .eq("user_id", userId)
            .eq("row_index", rowIndex);
        }),
      ),
    );

    await supabaseAdmin
      .from("jobs")
      .update({ status: "completed", message: "Completed", generated_sites: generated, deployed_sites: deployed })
      .eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Job failed";
    await supabaseAdmin.from("jobs").update({ status: "failed", message: msg }).eq("id", jobId);
  }
}

