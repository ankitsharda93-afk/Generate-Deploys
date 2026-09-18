import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const leadsRouter = Router();

const LeadSchema = z.object({
  pageUrl: z.string().url().optional().or(z.literal("")),
  service: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  name: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(80).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  // anti-spam honeypot
  company: z.string().max(200).optional().or(z.literal("")),
});

type RateEntry = { count: number; resetAt: number };
const rate = new Map<string, RateEntry>();

function getIp(req: any) {
  const xf = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xf || req.socket?.remoteAddress || "unknown";
}

function allow(ip: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const e = rate.get(ip);
  if (!e || e.resetAt < now) {
    rate.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (e.count >= max) return false;
  e.count += 1;
  return true;
}

leadsRouter.post("/", async (req, res) => {
  const ip = getIp(req);
  if (!allow(ip)) return res.status(429).json({ error: "Too many requests" });

  const parsed = LeadSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  if (parsed.data.company && parsed.data.company.trim().length > 0) return res.json({ ok: true }); // bot

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return res.status(500).json({ error: msg });
  }

  const ua = String(req.headers["user-agent"] ?? "");
  const { error } = await supabaseAdmin.from("leads").insert({
    page_url: parsed.data.pageUrl || null,
    service: parsed.data.service || null,
    city: parsed.data.city || null,
    name: parsed.data.name || null,
    phone: parsed.data.phone || null,
    message: parsed.data.message || null,
    user_agent: ua || null,
    ip,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

