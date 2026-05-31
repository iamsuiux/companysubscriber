import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getRecentScrapeLogs, isScrapingRunning } from '@/lib/db/scrape-logs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();

    const [logs, running] = await Promise.all([
      getRecentScrapeLogs(20),
      isScrapingRunning(),
    ]);

    return NextResponse.json({
      data: { logs, isRunning: running },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Get scrape logs error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get scrape logs', code: 'GET_LOGS_ERROR' } },
      { status: 500 }
    );
  }
}
