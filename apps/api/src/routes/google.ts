import { Router } from "express";
import crypto from "node:crypto";
import type { AuthedRequest } from "../middleware/requireUser.js";
import { requireUser } from "../middleware/requireUser.js";
import { createGoogleOAuth2Client, hasGoogleOAuthConfigured } from "../lib/googleSheets.js";
import { deleteUserGoogleRefreshToken, getUserGoogleRefreshToken, upsertUserGoogleRefreshToken } from "../lib/googleOAuthTokens.js";

export const googleRouter = Router();

function base64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function signState(payloadB64: string) {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET?.trim();
  if (!secret) throw new Error("Missing GOOGLE_OAUTH_STATE_SECRET");
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function makeState(userId: string) {
  const payload = { userId, ts: Date.now(), nonce: crypto.randomBytes(12).toString("hex") };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = signState(payloadB64);
  return `${payloadB64}.${sig}`;
}

function parseState(state: string): { userId: string } {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) throw new Error("Invalid state");
  const expected = signState(payloadB64);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("Invalid state signature");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { userId: string; ts: number };
  if (!payload.userId || !payload.ts) throw new Error("Invalid state payload");
  if (Date.now() - payload.ts > 15 * 60 * 1000) throw new Error("State expired. Please retry Connect Google.");
  return { userId: payload.userId };
}

googleRouter.get("/start", requireUser, async (req, res) => {
  if (!hasGoogleOAuthConfigured()) {
    return res.status(500).json({
      error:
        "Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URL, GOOGLE_OAUTH_STATE_SECRET in apps/api/.env",
    });
  }

  const userId = (req as unknown as AuthedRequest).userId;
  const oauth2 = createGoogleOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/documents.readonly"
    ],
    include_granted_scopes: true,
    state: makeState(userId),
  });
  return res.json({ url });
});

googleRouter.get("/callback", async (req, res) => {
  const webOrigin = process.env.WEB_ORIGIN?.trim() || "http://localhost:3000";
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    if (!code || !state) throw new Error("Missing code/state");
    const { userId } = parseState(state);

    const oauth2 = createGoogleOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      throw new Error(
        "Google did not return a refresh_token. Please revoke access in your Google Account security settings and try Connect Google again.",
      );
    }
    await upsertUserGoogleRefreshToken(userId, refreshToken);
    return res.redirect(`${webOrigin}/?google=connected`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google connect failed";
    return res.redirect(`${webOrigin}/?google=error&msg=${encodeURIComponent(msg)}`);
  }
});

googleRouter.get("/status", requireUser, async (req, res) => {
  const userId = (req as unknown as AuthedRequest).userId;
  try {
    const refresh = await getUserGoogleRefreshToken(userId);
    return res.json({ connected: Boolean(refresh) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to check Google status";
    return res.status(500).json({ error: msg });
  }
});

googleRouter.post("/disconnect", requireUser, async (req, res) => {
  const userId = (req as unknown as AuthedRequest).userId;
  try {
    await deleteUserGoogleRefreshToken(userId);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to disconnect";
    return res.status(500).json({ error: msg });
  }
});

