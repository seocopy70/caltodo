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
      const q = String(body.query || '').trim().toLocaleLowerCase();
      if (!q) return NextResponse.json({ events: [] });
      const result = await turso.execute({
        sql: 'SELECT id, title, start, end_time, source, location, description FROM events WHERE user_id = ?',
        args: [uid],
      });
      const events = result.rows.filter((row: any) =>
        [row.title, row.location, row.description].some((value: any) => String(value || '').toLocaleLowerCase().includes(q))
      ).slice(0, 200);
      return NextResponse.json({ events });
    }

    if (action === 'delete_all') {
      const result = await turso.execute({ sql: 'DELETE FROM events WHERE user_id = ?', args: [uid] });
      return NextResponse.json({ deleted: Number(result.rowsAffected || 0) });
    }

    if (action === 'delete_imported') {
      const result = await turso.execute({ sql: 'DELETE FROM events WHERE user_id = ? AND source = ?', args: [uid, 'google_ics'] });
      return NextResponse.json({ deleted: Number(result.rowsAffected || 0) });
    }

    if (action === 'delete_search') {
      const q = String(body.query || '').trim().toLocaleLowerCase();
      if (!q) return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 });
      const result = await turso.execute({
        sql: 'SELECT id, title, location, description FROM events WHERE user_id = ?',
        args: [uid],
      });
      const matches = result.rows.filter((row: any) =>
        [row.title, row.location, row.description].some((value: any) => String(value || '').toLocaleLowerCase().includes(q))
      );
      let deleted = 0;
      for (const row of matches) {
        const r = await turso.execute({ sql: 'DELETE FROM events WHERE id = ? AND user_id = ?', args: [row.id, uid] });
        deleted += Number(r.rowsAffected || 0);
      }
      return NextResponse.json({ deleted });
    }

    return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('[POST /api/events/manage]', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
