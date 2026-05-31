import { supabaseServer } from '@/lib/supabase/server';
import type { ScrapeLogWithCompany } from '@/types';

export async function isScrapingRunning(): Promise<boolean> {
  const { data } = await supabaseServer
    .from('scrape_logs')
    .select('id')
    .eq('status', 'running')
    .limit(1);

  return (data && data.length > 0) || false;
}

export async function getRecentScrapeLogs(
  limit: number = 20
): Promise<ScrapeLogWithCompany[]> {
  const { data, error } = await supabaseServer
    .from('scrape_logs')
    .select('*, company:companies(name)')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data as unknown as ScrapeLogWithCompany[]) || [];
}

export async function getScrapeRunSummary(): Promise<{
  lastRunAt: string | null;
  totalJobsFound: number;
  totalJobsNew: number;
  companiesScraped: number;
  errors: number;
}> {
  // Get the most recent batch of scrape logs (all with the same approximate started_at)
  const { data: latestLog } = await supabaseServer
    .from('scrape_logs')
    .select('started_at')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!latestLog) {
    return {
      lastRunAt: null,
      totalJobsFound: 0,
      totalJobsNew: 0,
      companiesScraped: 0,
      errors: 0,
    };
  }

  // Get all logs from the same run (within 1 minute of each other)
  const runStart = new Date(latestLog.started_at);
  const runWindow = new Date(runStart.getTime() - 60000).toISOString();

  const { data: runLogs } = await supabaseServer
    .from('scrape_logs')
    .select('*')
    .gte('started_at', runWindow)
    .order('started_at', { ascending: false });

  if (!runLogs) {
    return {
      lastRunAt: latestLog.started_at,
      totalJobsFound: 0,
      totalJobsNew: 0,
      companiesScraped: 0,
      errors: 0,
    };
  }

  return {
    lastRunAt: latestLog.started_at,
    totalJobsFound: runLogs.reduce((sum, l) => sum + (l.jobs_found || 0), 0),
    totalJobsNew: runLogs.reduce((sum, l) => sum + (l.jobs_new || 0), 0),
    companiesScraped: runLogs.length,
    errors: runLogs.filter((l) => l.status === 'error').length,
  };
}
