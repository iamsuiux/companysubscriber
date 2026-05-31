import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getNewJobs } from '@/lib/db/jobs';
import { getScrapeRunSummary } from '@/lib/db/scrape-logs';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();

    const [newJobs, summary, companiesResult] = await Promise.all([
      getNewJobs(7),
      getScrapeRunSummary(),
      supabaseServer
        .from('companies')
        .select('id', { count: 'exact' })
        .eq('is_active', true),
    ]);

    // Group jobs by company
    const jobsByCompany: Record<
      string,
      { companyName: string; jobs: typeof newJobs }
    > = {};

    for (const job of newJobs) {
      const companyId = job.company_id;
      if (!jobsByCompany[companyId]) {
        jobsByCompany[companyId] = {
          companyName: job.company?.name || 'Unknown',
          jobs: [],
        };
      }
      jobsByCompany[companyId].jobs.push(job);
    }

    return NextResponse.json({
      data: {
        stats: {
          newJobCount: newJobs.length,
          companyCount: companiesResult.count || 0,
          lastScrapeAt: summary.lastRunAt,
        },
        jobsByCompany: Object.values(jobsByCompany),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to load dashboard', code: 'DASHBOARD_ERROR' } },
      { status: 500 }
    );
  }
}
