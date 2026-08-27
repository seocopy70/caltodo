import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';
import { createLinkedEventForTodo } from '../../../lib/linking';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({
    sql: 'SELECT * FROM todos WHERE user_id = ? ORDER BY completed ASC, order_index ASC, created_at ASC',
    args: [uid],
  });

  const todos = result.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    dueDate: row.due_date ? new Date(Number(row.due_date)).toISOString() : null,
    memo: row.memo,
    orderIndex: Number(row.order_index || 0),
    priority: row.priority || null,
    completedAt: row.completed_at ? new Date(Number(row.completed_at)).toISOString() : null,
    linkedEventId: row.linked_event_id || null,
    folderId: row.folder_id || null,
    createdAt: new Date(Number(row.created_at)).toISOString(),
  }));

  return NextResponse.json({ todos });
}

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  // 백업 복원 시엔 원래 id를 그대로 유지 (재가져오기해도 중복되지 않도록)
  const id = body.id || randomUUID();
  const minResult = await turso.execute({ sql: 'SELECT COALESCE(MIN(order_index), 1) AS min_order FROM todos WHERE user_id = ?', args: [uid] });
  const orderIndex = body.orderIndex !== undefined ? Number(body.orderIndex) : Number(minResult.rows[0]?.min_order ?? 1) - 1;
  const dueDateMs = body.dueDate ? new Date(body.dueDate).getTime() : null;

  let linkedEventId: string | null = body.linkedEventId || null;
  if (!linkedEventId && dueDateMs && !body.skipLink) {
    linkedEventId = await createLinkedEventForTodo(uid, body.title, dueDateMs);
  }

  await turso.execute({
    sql: `INSERT OR REPLACE INTO todos (id, user_id, title, completed, due_date, memo, order_index, priority, completed_at, linked_event_id, folder_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, uid, body.title, body.completed ? 1 : 0, dueDateMs, body.memo || '', orderIndex, body.priority || null, body.completedAt ? new Date(body.completedAt).getTime() : null, linkedEventId, body.folderId || null, body.createdAt ? new Date(body.createdAt).getTime() : Date.now()],
  });

  return NextResponse.json({ id, linkedEventId });
}
