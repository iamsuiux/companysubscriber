import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('Checking for stuck scrape logs...\n');

  const { data: stuckLogs, error: fetchError } = await supabase
    .from('scrape_logs')
    .select('id, company_id, started_at')
    .eq('status', 'running');

  if (fetchError) {
    console.error('Error fetching scrape logs:', fetchError.message);
    process.exit(1);
  }

  if (!stuckLogs || stuckLogs.length === 0) {
    console.log('✓ No stuck scrape logs found. Everything is clean!');
    return;
  }

  console.log(`Found ${stuckLogs.length} stuck scrape log(s):`);
  stuckLogs.forEach((log, i) => {
    const startedAt = new Date(log.started_at);
    const now = new Date();
    const durationMs = now.getTime() - startedAt.getTime();
    const durationMins = Math.floor(durationMs / 60000);
    console.log(`  [${i + 1}] ID: ${log.id.slice(0, 8)}... (stuck for ${durationMins} minutes)`);
  });

  console.log('\nClearing stuck records...');

  const { error: updateError } = await supabase
    .from('scrape_logs')
    .update({
      status: 'error',
      completed_at: new Date().toISOString(),
      error_message: 'Cleared stale scrape from previous run (stuck in running state)',
    })
    .eq('status', 'running');

  if (updateError) {
    console.error('Error clearing stuck logs:', updateError.message);
    process.exit(1);
  }

  console.log(`✓ Successfully cleared ${stuckLogs.length} stuck scrape log(s)`);
  console.log('\nThe scraper should now be able to run again.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
