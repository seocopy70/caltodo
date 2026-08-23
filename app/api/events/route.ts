import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

export async function GET() {
  try {
    const now = Date.now();

    const result = await turso.execute({
      sql: `INSERT INTO events (
        id,
        user_id,
        title,
        start,
        end_time,
        end_date,
        location,
        description,
        color,
        recurrence_type,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        'TEST_USER',
        'API 테스트 일정',
        now,
        now + 60 * 60 * 1000,
        null,
        '',
        '',
        'blue',
        'none',
        now,
      ],
    });

    return NextResponse.json({
      ok: true,
      result,
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
