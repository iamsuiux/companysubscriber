import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllSettings, updateSetting } from '@/lib/db/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
    const settings = await getAllSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get settings', code: 'GET_SETTINGS_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: { message: 'key and value are required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const setting = await updateSetting(key, String(value));
    return NextResponse.json({ data: setting });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Update setting error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update setting', code: 'UPDATE_SETTING_ERROR' } },
      { status: 500 }
    );
  }
}
