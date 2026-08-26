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
    recurrenceCount: row.recurrence_count == null ? null : Number(row.recurrence_count),
    isLunar: Number(row.is_lunar || 0) === 1,
    lunarMonth: row.lunar_month == null ? null : Number(row.lunar_month),
    lunarDay: row.lunar_day == null ? null : Number(row.lunar_day),
    source: row.source || 'manual',
    externalUid: row.external_uid || null,
    linkedTodoId: row.linked_todo_id || null,
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  }));

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json();
    // 백업 복원 시엔 원래 id를 그대로 유지 (재가져오기해도 중복되지 않도록)
    const id = body.id || randomUUID();
    const now = Date.now();
    const source = body.source || 'manual';
    const externalUid = body.externalUid || null;

    if (!body.id && source !== 'manual' && externalUid) {
      const existing = await turso.execute({
        sql: 'SELECT id FROM events WHERE user_id = ? AND source = ? AND external_uid = ? LIMIT 1',
        args: [uid, source, externalUid],
      });
      if (existing.rows.length > 0) {
        return NextResponse.json({ id: existing.rows[0].id, skipped: true });
      }
    }

    await turso.execute({
      sql: `INSERT OR REPLACE INTO events (id, user_id, title, start, end_time, end_date, location, description, color, recurrence_type, recurrence_count, is_lunar, lunar_month, lunar_day, updated_at, source, external_uid, linked_todo_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        body.recurrenceCount || null,
        body.isLunar ? 1 : 0,
        body.lunarMonth ?? null,
        body.lunarDay ?? null,
        now,
        source,
        externalUid,
        body.linkedTodoId || null,
      ],
    });

    return NextResponse.json({ id, skipped: false });
  } catch (error: any) {
    console.error('[POST /api/events]', error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
