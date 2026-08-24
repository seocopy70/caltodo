import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';

async function assertOwnership(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT user_id FROM todos WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return false;
  return result.rows[0].user_id === uid;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const sets: string[] = [];
  const args: any[] = [];

  if (body.title !== undefined) { sets.push('title = ?'); args.push(body.title); }
  if (body.completed !== undefined) {
    sets.push('completed = ?'); args.push(body.completed ? 1 : 0);
    sets.push('completed_at = ?'); args.push(body.completed ? Date.now() : null);
  }
  if (body.dueDate !== undefined) { sets.push('due_date = ?'); args.push(body.dueDate ? new Date(body.dueDate).getTime() : null); }
  if (body.memo !== undefined) { sets.push('memo = ?'); args.push(body.memo); }
  if (body.orderIndex !== undefined) { sets.push('order_index = ?'); args.push(Number(body.orderIndex)); }
  if (body.priority !== undefined) {
    sets.push('priority = ?'); args.push(body.priority || null);
    if (body.priority && body.bumpToTop) {
      const minResult = await turso.execute({ sql: 'SELECT COALESCE(MIN(order_index), 1) AS min_order FROM todos WHERE user_id = ?', args: [uid] });
      sets.push('order_index = ?'); args.push(Number(minResult.rows[0]?.min_order ?? 1) - 1);
    }
  }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  args.push(params.id);
  await turso.execute({ sql: `UPDATE todos SET ${sets.join(', ')} WHERE id = ?`, args });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await turso.execute({ sql: 'DELETE FROM todos WHERE id = ?', args: [params.id] });
  return NextResponse.json({ ok: true });
}
