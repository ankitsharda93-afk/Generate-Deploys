const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
  const env = fs.readFileSync('apps/api/.env', 'utf8');
  const supabaseUrl = env.match(/SUPABASE_URL=([^\s]+)/)[1];
  const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/)[1];
  
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: jobs, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('JOBS:', JSON.stringify(jobs, null, 2));
}

check().catch(console.error);
