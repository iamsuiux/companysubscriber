import { supabaseServer } from '@/lib/supabase/server';
import type { JobWithCompany } from '@/types';

export async function getNewJobs(days: number = 7): Promise<JobWithCompany[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseServer
    .from('jobs')
    .select('*, company:companies(name)')
    .gte('first_seen_at', since)
    .eq('is_active', true)
    // Filter for developer-related jobs only
    .or('title.ilike.%software%,title.ilike.%engineer%,title.ilike.%developer%')
    .order('first_seen_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as JobWithCompany[]) || [];
}

export async function getAllJobsPaginated(
  offset: number = 0,
  limit: number = 50
): Promise<{ jobs: JobWithCompany[]; total: number }> {
  const { data, error, count } = await supabaseServer
    .from('jobs')
    .select('*, company:companies(name)', { count: 'exact' })
    // Filter for developer-related jobs only
    .or('title.ilike.%software%,title.ilike.%engineer%,title.ilike.%developer%')
    .order('first_seen_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return {
    jobs: (data as unknown as JobWithCompany[]) || [],
    total: count || 0,
  };
}
