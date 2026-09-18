import { createClient } from "@supabase/supabase-js";

// Keeping this as `any` avoids requiring generated Supabase Database typings for this starter.
// If you want strong typing, generate `database.types.ts` from Supabase and replace `any` accordingly.
let cached: any = null;

export function getSupabaseAdmin() {
  if (cached) return cached;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as any;
  return cached;
}

