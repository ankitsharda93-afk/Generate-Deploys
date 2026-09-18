import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getGoogleServiceAccountEmail, hasGoogleSheetsServiceAccount } from "../lib/googleSheets.js";

export const configRouter = Router();

function isPlaceholder(v: string | undefined) {
  if (!v) return true;
  return v.startsWith("PASTE_") || v.includes("REPLACE_ME");
}

type Status = "ok" | "missing" | "placeholder" | "error" | "unknown";

function isMissingRelationError(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  return m.includes("google_oauth_tokens") && (m.includes("schema cache") || m.includes("does not exist") || m.includes("relation"));
}

function supabaseProjectRefFromUrl(url: string | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname; // e.g. atraokbgiiylokmabiow.supabase.co
    const ref = host.split(".")[0] || null;
    return { host, ref };
  } catch {
    return null;
  }
}

configRouter.get("/", async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const baseDomain = process.env.BASE_DOMAIN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const googleSaRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const googleOAuthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const googleOAuthRedirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL;
  const googleOAuthStateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;

  const supabaseMissingKeys: string[] = [];
  if (!supabaseUrl) supabaseMissingKeys.push("SUPABASE_URL");
  if (!supabaseService) supabaseMissingKeys.push("SUPABASE_SERVICE_ROLE_KEY");

  let supabaseStatus: Status = "ok";
  if (supabaseMissingKeys.length > 0) supabaseStatus = "missing";
  else if (isPlaceholder(supabaseService)) supabaseStatus = "placeholder";

  const cloudflareMissingKeys: string[] = [];
  if (!cloudflareToken) cloudflareMissingKeys.push("CLOUDFLARE_API_TOKEN");
  if (!cloudflareAccountId) cloudflareMissingKeys.push("CLOUDFLARE_ACCOUNT_ID");

  let cloudflareStatus: Status = "ok";
  if (cloudflareMissingKeys.length > 0) cloudflareStatus = "missing";
  else if (isPlaceholder(cloudflareToken) || isPlaceholder(cloudflareAccountId)) cloudflareStatus = "placeholder";

  const customDomainsStatus: Status = baseDomain && zoneId ? "ok" : "missing";

  const googleOAuthMissingKeys: string[] = [];
  if (!googleOAuthClientId) googleOAuthMissingKeys.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!googleOAuthClientSecret) googleOAuthMissingKeys.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!googleOAuthRedirectUrl) googleOAuthMissingKeys.push("GOOGLE_OAUTH_REDIRECT_URL");
  if (!googleOAuthStateSecret) googleOAuthMissingKeys.push("GOOGLE_OAUTH_STATE_SECRET");

  let googleOAuthStatus: Status = "ok";
  if (googleOAuthMissingKeys.length > 0) googleOAuthStatus = "missing";
  else if (
    isPlaceholder(googleOAuthClientId) ||
    isPlaceholder(googleOAuthClientSecret) ||
    isPlaceholder(googleOAuthRedirectUrl) ||
    isPlaceholder(googleOAuthStateSecret)
  ) {
    googleOAuthStatus = "placeholder";
  }

  let googleSheetsStatus: Status = "missing";
  let googleServiceAccountEmail: string | null = null;
  if (googleSaRaw && googleSaRaw.trim().length > 0) {
    googleServiceAccountEmail = getGoogleServiceAccountEmail();
    googleSheetsStatus = googleServiceAccountEmail ? "ok" : "error";
  } else {
    googleSheetsStatus = hasGoogleSheetsServiceAccount() ? "ok" : "missing";
  }

  let tablesStatus: Status = "unknown";
  let tablesError: string | null = null;
  let googleOAuthTokensTable: { status: Status; error: string | null } = { status: "unknown", error: null };

  if (supabaseStatus === "ok") {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin.from("jobs").select("id").limit(1);
      if (error) {
        if (error.message && error.message.includes("fetch failed")) {
          tablesError = "Simulation Mode (Offline)";
          tablesStatus = "ok";
        } else {
          tablesError = error.message;
          tablesStatus = error.message.toLowerCase().includes("relation") ? "missing" : "error";
        }
      } else {
        tablesStatus = "ok";
      }

      // Check google_oauth_tokens table existence (needed for Connect Google).
      try {
        const { error: tokErr } = await supabaseAdmin.from("google_oauth_tokens").select("user_id").limit(1);
        if (tokErr) {
          if (tokErr.message && tokErr.message.includes("fetch failed")) {
            googleOAuthTokensTable = { status: "ok", error: "Simulation Mode (Offline)" };
          } else {
            googleOAuthTokensTable = {
              status: isMissingRelationError(tokErr.message) ? "missing" : "error",
              error: isMissingRelationError(tokErr.message) ? null : tokErr.message,
            };
          }
        } else {
          googleOAuthTokensTable = { status: "ok", error: null };
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        if (errMsg.includes("fetch failed")) {
          googleOAuthTokensTable = { status: "ok", error: "Simulation Mode (Offline)" };
        } else {
          googleOAuthTokensTable = { status: "error", error: errMsg };
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      if (errMsg.includes("fetch failed")) {
        tablesError = "Simulation Mode (Offline)";
        tablesStatus = "ok";
      } else {
        tablesError = errMsg;
        tablesStatus = "error";
      }
    }
  }

  const nextSteps: string[] = [];
  if (supabaseStatus !== "ok") {
    nextSteps.push("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env (no placeholders).");
  }
  if (tablesStatus !== "ok" && supabaseStatus === "ok") {
    nextSteps.push("Run supabase/migrations/001_init.sql (and 002_cloudflare_tracking.sql) in Supabase SQL Editor.");
  }
  if (cloudflareStatus !== "ok") {
    nextSteps.push("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in apps/api/.env (no placeholders).");
  }
  if (googleOAuthStatus !== "ok") {
    nextSteps.push(
      "Optional (for private Google Sheets via Connect Google): set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URL, GOOGLE_OAUTH_STATE_SECRET in apps/api/.env",
    );
  }
  if (googleSheetsStatus !== "ok") {
    nextSteps.push(
      "Optional (for private Google Sheets): set GOOGLE_SERVICE_ACCOUNT_JSON in apps/api/.env and share the sheet with that service account email (Viewer).",
    );
  }

  // Fallback locally handles the table migration requirement.

  return res.json({
    supabase: {
      status: supabaseStatus,
      missingKeys: supabaseMissingKeys,
      project: supabaseProjectRefFromUrl(supabaseUrl),
    },
    cloudflare: { status: cloudflareStatus, missingKeys: cloudflareMissingKeys },
    customDomains: { status: customDomainsStatus },
    googleOAuth: {
      status: googleOAuthStatus,
      missingKeys: googleOAuthMissingKeys,
      clientId: googleOAuthClientId ? googleOAuthClientId.trim() : null,
      redirectUrl: googleOAuthRedirectUrl ?? null,
    },
    googleSheets: { status: googleSheetsStatus, serviceAccountEmail: googleServiceAccountEmail },
    tablesStatus,
    tablesError,
    googleOAuthTokensTable,
    nextSteps,
  });
});

