import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestUser } from '../../../lib/auth-server';

export async function GET() {
  return NextResponse.json({ method: 'GET', ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);

    if (!uid) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      method: 'POST',
      ok: true,
      uid,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
