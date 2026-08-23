import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({
    sql: 'SELECT * FROM events WHERE user_id = ? ORDER BY start ASC',
    args: [uid],
  });

  const events = result.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    start: new Date(Number(row.start)).toISOString(),
    end: new Date(Number(row.end_time)).toISOString(),
    endDate: row.end_date ? new Date(Number(row.end_date)).toISOString() : null,
    location: row.location,
    description: row.description,
    color: row.color,
    recurrenceType: row.recurrence_type,
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  }));

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);

    if (!uid) {
      return NextResponse.json(
        { step: 'auth', error: 'unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

    return NextResponse.json({
      step: 'body',
      uid,
      body,
    });

  } catch (error: any) {
    console.error('[POST /api/events DEBUG]', error);

    return NextResponse.json(
      {
        step: 'exception',
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
