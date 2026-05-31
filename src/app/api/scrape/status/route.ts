import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isScrapingRunning } from '@/lib/db/scrape-logs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();

    const running = await isScrapingRunning();
    return NextResponse.json({ data: { isRunning: running } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Scrape status error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get scrape status', code: 'STATUS_ERROR' } },
      { status: 500 }
    );
  }
}
