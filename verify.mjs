import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://atraokbgiiylokmabiow.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cmFva2JnaWl5bG9rbWFiaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc2NDIzNCwiZXhwIjoyMDg5MzQwMjM0fQ.a-kUQOxLwlXV6xQy9IqjOnxBT9YzSq_85SUyrJAo_5I";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("Checking jobs table...");
  const res1 = await supabase.from("jobs").select("id").limit(1);
  console.log("jobs:", res1.error ? ("Error: " + res1.error.message) : "OK");

  console.log("Checking google_oauth_tokens table...");
  const res2 = await supabase.from("google_oauth_tokens").select("user_id").limit(1);
  console.log("google_oauth_tokens:", res2.error ? ("Error: " + res2.error.message) : "OK");
}

check().catch(console.error);
