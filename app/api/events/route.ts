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
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const id = randomUUID();
  const now = Date.now();

  await turso.execute({
    sql: `INSERT INTO events (id, user_id, title, start, end_time, end_date, location, description, color, recurrence_type, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      uid,
      body.title,
      new Date(body.start).getTime(),
      new Date(body.end).getTime(),
      body.endDate ? new Date(body.endDate).getTime() : null,
      body.location || '',
      body.description || '',
      body.color || 'blue',
      body.recurrenceType || 'none',
      now,
    ],
  });

  return NextResponse.json({ id });
}
