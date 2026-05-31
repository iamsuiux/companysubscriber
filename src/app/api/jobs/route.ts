import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllJobsPaginated } from '@/lib/db/jobs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { jobs, total } = await getAllJobsPaginated(offset, limit);

    return NextResponse.json({
      data: { jobs, total, offset, limit },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Get jobs error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get jobs', code: 'GET_JOBS_ERROR' } },
      { status: 500 }
    );
  }
}
