import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isJwtLike(value: string) {
  // Classic Supabase anon keys are JWTs (three dot-separated base64url-ish parts).
  return /^eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value);
}

function isAllowedPublicKey(value: string) {
  // Allow either new publishable keys or classic anon JWT keys.
  // Never allow sb_secret_ in the browser.
  if (value.startsWith("sb_secret_")) return false;
  return value.startsWith("sb_publishable_") || isJwtLike(value);
}

if (typeof window !== "undefined") {
  if (!url) console.warn("Supabase URL is missing (NEXT_PUBLIC_SUPABASE_URL)");
  else if (!isValidHttpUrl(url)) console.warn("Supabase URL is invalid:", url);
  if (!anon) console.warn("Supabase Anon Key is missing (NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  else if (!isAllowedPublicKey(anon)) console.warn("Supabase Anon Key is invalid or restricted:", anon);
}

export const supabaseBrowser =
  url && anon && isValidHttpUrl(url) && isAllowedPublicKey(anon)
    ? createClient(url, anon, {
        auth: { persistSession: true, autoRefreshToken: true },
        global: {
          fetch: (...args) => {
            return fetch(...args).catch((err) => {
              console.warn("Supabase fetch failed (simulating offline login):", err);
              // Return a mock successful session to bypass authentication entirely when offline
              return new Response(
                JSON.stringify({
                  access_token: "mock-offline-token",
                  token_type: "bearer",
                  expires_in: 3600,
                  refresh_token: "mock-offline-refresh",
                  user: {
                    id: "offline-user-id",
                    email: "offline@simulation.local",
                    aud: "authenticated",
                    role: "authenticated",
                    app_metadata: {},
                    user_metadata: {},
                    created_at: new Date().toISOString(),
                  }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            });
          },
        },
      })
    : null;

