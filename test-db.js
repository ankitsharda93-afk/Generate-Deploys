
import dotenv from "dotenv";
dotenv.config({ path: "./apps/api/.env" });
import { getSupabaseAdmin } from "./apps/api/src/lib/supabaseAdmin.ts";

async function check() {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];
  const { data: jobs, error: jErr } = await supabase.from("jobs").select("*").gte("created_at", today).order("created_at", { ascending: false });
  console.log("TODAY'S JOBS:", JSON.stringify(jobs, null, 2));
}
check();
