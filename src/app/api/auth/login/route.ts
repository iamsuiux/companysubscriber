import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/utils/validation';
import { getUserByUsername } from '@/lib/db/users';
import { verifyPassword, signToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: { message: result.error.errors[0].message, code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const { username, password } = result.data;

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } },
        { status: 401 }
      );
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
    });

    const response = NextResponse.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          created_at: user.created_at,
        },
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { message: 'Login failed', code: 'LOGIN_ERROR' } },
      { status: 500 }
    );
  }
}
