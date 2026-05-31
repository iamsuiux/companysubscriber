import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ data: { user: null } });
    }

    return NextResponse.json({
      data: {
        user: {
          id: session.userId,
          username: session.username,
        },
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ data: { user: null } });
  }
}
