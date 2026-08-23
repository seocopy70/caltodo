import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

export async function GET() {
  try {
    const result = await turso.execute('SELECT 1 AS test');

    return NextResponse.json({
      ok: true,
      result: result.rows,
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
