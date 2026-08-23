import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestUser } from '../../../lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);

    if (!uid) {
      return NextResponse.json(
        {
          ok: false,
          step: 'auth',
          message: '인증 토큰이 없거나 유효하지 않습니다.'
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      step: 'auth',
      uid,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: 'exception',
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: 'POST 자체는 정상입니다.',
  });
}
