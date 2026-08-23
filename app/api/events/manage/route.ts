import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'search') {
      const q = String(body.query || '').trim();
      if (!q) return NextResponse.json({ events: [] });
      const pattern = `%${q}%`;
      const result = await turso.execute({
        sql: `SELECT id, title, start, end_time, source FROM events
              WHERE user_id = ? AND (title LIKE ? OR location LIKE ? OR description LIKE ?)
              ORDER BY start DESC LIMIT 200`,
        args: [uid, pattern, pattern, pattern],
      });
      return NextResponse.json({ events: result.rows });
    }

    if (action === 'delete_all') {
      const result = await turso.execute({ sql: 'DELETE FROM events WHERE user_id = ?', args: [uid] });
      return NextResponse.json({ deleted: Number(result.rowsAffected || 0) });
    }

    if (action === 'delete_imported') {
      const result = await turso.execute({
        sql: "DELETE FROM events WHERE user_id = ? AND source = 'google_ics'",
        args: [uid],
      });
      return NextResponse.json({ deleted: Number(result.rowsAffected || 0) });
    }

    if (action === 'delete_search') {
      const q = String(body.query || '').trim();
      if (!q) return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 });
      const pattern = `%${q}%`;
      const result = await turso.execute({
        sql: `DELETE FROM events
              WHERE user_id = ? AND (title LIKE ? OR location LIKE ? OR description LIKE ?)`,
        args: [uid, pattern, pattern, pattern],
      });
      return NextResponse.json({ deleted: Number(result.rowsAffected || 0) });
    }

    return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('[POST /api/events/manage]', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
