const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabaseUrl = 'https://atraokbgiiylokmabiow.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cmFva2JnaWl5bG9rbWFiaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc2NDIzNCwiZXhwIjoyMDg5MzQwMjM0fQ.a-kUQOxLwlXV6xQy9IqjOnxBT9YzSq_85SUyrJAo_5I';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
    console.log('--- Testing Job Lifecycle ---');
    const userId = '453c282b-28c2-446c-906f-f7741b49e2d8'; // The user from the existing job

    console.log('1. Creating Job...');
    const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert({
            user_id: userId,
            status: 'queued',
            message: 'Test Job',
            total_sites: 1,
            generated_sites: 0,
            deployed_sites: 0,
        })
        .select('*')
        .single();

    if (jobErr) {
        console.error('Job creation failed:', jobErr);
        return;
    }
    console.log('Job created:', job.id);

    console.log('2. Creating Site...');
    const { error: sitesErr } = await supabase.from('sites').insert({
        job_id: job.id,
        user_id: userId,
        row_index: 1,
        title: 'Test Site',
        status: 'queued',
    });

    if (sitesErr) {
        console.error('Site creation failed:', sitesErr);
        return;
    }
    console.log('Site created.');

    console.log('3. Updating Site Status (Generation)...');
    const { error: updErr1 } = await supabase
        .from('sites')
        .update({ status: 'generated' })
        .eq('job_id', job.id)
        .eq('user_id', userId)
        .eq('row_index', 1);

    if (updErr1) {
        console.error('Update 1 failed:', updErr1);
    } else {
        console.log('Update 1 OK.');
    }

    console.log('4. Updating Site Status (Deployment)...');
    const { data: sitesBeforeMatch, error: matchErr } = await supabase.from('sites').select('*').eq('job_id', job.id).eq('row_index', 1);
    console.log('Site before update:', JSON.stringify(sitesBeforeMatch, null, 2));

    const { error: updErr2 } = await supabase
        .from('sites')
        .update({ status: 'deployed', url: 'https://test.pages.dev' })
        .eq('job_id', job.id)
        .eq('user_id', userId)
        .eq('row_index', 1);

    if (updErr2) {
        console.error('Update 2 failed:', updErr2);
    } else {
        console.log('Update 2 OK.');
    }

    console.log('5. Verifying Site status...');
    const { data: verifyData } = await supabase.from('sites').select('*').eq('job_id', job.id).eq('row_index', 1);
    console.log('Verification:', JSON.stringify(verifyData, null, 2));
}

test().catch(console.error);
