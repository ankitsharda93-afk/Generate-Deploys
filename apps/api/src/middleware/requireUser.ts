import type { NextFunction, Request, Response } from "express";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export type AuthedRequest = Request & { userId: string };

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase not configured";
    return res.status(500).json({ error: msg });
  }

  const auth = req.header("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Missing Bearer token" });

  const token = match[1];

  if (token === "mock-offline-token") {
    // Simulation Mode bypass
    (req as AuthedRequest).userId = "offline-user-id";
    return next();
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

    (req as AuthedRequest).userId = data.user.id;
    next();
  } catch (err) {
    console.warn("Supabase auth check failed (offline?):", err);
    return res.status(502).json({ error: "Auth service unreachable" });
  }
}

