import { getSupabaseAdmin } from "./supabaseAdmin.js";
import fs from "fs";
import path from "path";

const TOKENS_FILE = path.resolve(process.cwd(), ".data", "google_tokens.json");

function getLocalTokens(): Record<string, string> {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to read local tokens file:", e);
  }
  return {};
}

function saveLocalTokens(tokens: Record<string, string>) {
  try {
    const dir = path.dirname(TOKENS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch (e) {
    console.error("Failed to save local tokens file:", e);
  }
}

function isMissingRelationError(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  return m.includes("google_oauth_tokens") && (m.includes("schema cache") || m.includes("does not exist") || m.includes("relation"));
}

export async function getUserGoogleRefreshToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      const tokens = getLocalTokens();
      return tokens[userId] ?? null;
    }
    throw new Error(error.message);
  }
  return (data?.refresh_token as string | undefined) ?? null;
}

export async function upsertUserGoogleRefreshToken(userId: string, refreshToken: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("google_oauth_tokens").upsert({
    user_id: userId,
    refresh_token: refreshToken,
  });

  if (error) {
    if (isMissingRelationError(error.message)) {
      const tokens = getLocalTokens();
      tokens[userId] = refreshToken;
      saveLocalTokens(tokens);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteUserGoogleRefreshToken(userId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("google_oauth_tokens").delete().eq("user_id", userId);

  if (error) {
    if (isMissingRelationError(error.message)) {
      const tokens = getLocalTokens();
      delete tokens[userId];
      saveLocalTokens(tokens);
      return;
    }
    throw new Error(error.message);
  }
}

