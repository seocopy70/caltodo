import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';

async function assertOwnership(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT user_id FROM events WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return false;
  return result.rows[0].user_id === uid;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  await turso.execute({
    sql: `UPDATE events SET title=?, start=?, end_time=?, end_date=?, location=?, description=?, color=?, recurrence_type=?, updated_at=? WHERE id=?`,
    args: [
      body.title,
      new Date(body.start).getTime(),
      new Date(body.end).getTime(),
      body.endDate ? new Date(body.endDate).getTime() : null,
      body.location || '',
      body.description || '',
      body.color || 'blue',
      body.recurrenceType || 'none',
      Date.now(),
      params.id,
    ],
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await turso.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [params.id] });
  return NextResponse.json({ ok: true });
}
