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

    // Return a flat, date-sorted list (newest first). getNewJobs already
    // orders by first_seen_at descending, so no grouping/re-sort is needed.
    return NextResponse.json({
      data: {
        stats: {
          newJobCount: newJobs.length,
          companyCount: companiesResult.count || 0,
          lastScrapeAt: summary.lastRunAt,
        },
        jobs: newJobs,
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
