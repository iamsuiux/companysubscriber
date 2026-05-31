import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isScrapingRunning } from '@/lib/db/scrape-logs';

export async function POST() {
  try {
    await requireAuth();

    // Check if scrape is already running
    const running = await isScrapingRunning();
    if (running) {
      return NextResponse.json(
        { error: { message: 'Scrape already in progress', code: 'SCRAPE_RUNNING' } },
        { status: 409 }
      );
    }

    // Trigger scraper service
    const scraperUrl = process.env.SCRAPER_API_URL || 'http://localhost:4000';
    const scraperKey = process.env.SCRAPER_API_KEY || '';

    const response = await fetch(`${scraperUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': scraperKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: { message: 'Failed to trigger scraper', code: 'SCRAPER_ERROR' } },
        { status: 502 }
      );
    }

    return NextResponse.json({ data: { message: 'Scrape triggered' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Trigger scrape error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to trigger scrape', code: 'TRIGGER_ERROR' } },
      { status: 500 }
    );
  }
}
