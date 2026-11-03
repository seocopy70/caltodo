import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';
import { createLinkedEventForTodo } from '../../../lib/linking';
import { isValidClientId } from '../../../lib/client-id';

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
  // 앱이 미리 정한 id로 "한 번만" 저장(notes와 동일). 재전송이면 연동 일정도 다시 만들지 않고 기존 결과를 돌려준다.
  const idempotent = body.idempotent === true && isValidClientId(body.id);
  if (body.idempotent === true && !idempotent) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  if (idempotent) {
    const existing = await turso.execute({ sql: 'SELECT user_id, linked_event_id FROM todos WHERE id = ?', args: [id] });
    if (existing.rows.length > 0) {
      if (existing.rows[0].user_id !== uid) return NextResponse.json({ error: 'id conflict' }, { status: 409 });
      return NextResponse.json({ id, linkedEventId: existing.rows[0].linked_event_id || null, duplicate: true });
    }
  }
  const minResult = await turso.execute({ sql: 'SELECT COALESCE(MIN(order_index), 1) AS min_order FROM todos WHERE user_id = ?', args: [uid] });
  const orderIndex = body.orderIndex !== undefined ? Number(body.orderIndex) : Number(minResult.rows[0]?.min_order ?? 1) - 1;
  const dueDateMs = body.dueDate ? new Date(body.dueDate).getTime() : null;

  let linkedEventId: string | null = body.linkedEventId || null;
  let createdLinkedEvent = false;
  if (!linkedEventId && dueDateMs && !body.skipLink) {
    linkedEventId = await createLinkedEventForTodo(uid, body.title, dueDateMs);
    createdLinkedEvent = true;
  }

  const result = await turso.execute({
    sql: `${idempotent ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE'} INTO todos (id, user_id, title, completed, due_date, memo, order_index, priority, completed_at, linked_event_id, folder_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, uid, body.title, body.completed ? 1 : 0, dueDateMs, body.memo || '', orderIndex, body.priority || null, body.completedAt ? new Date(body.completedAt).getTime() : null, linkedEventId, body.folderId || null, body.createdAt ? new Date(body.createdAt).getTime() : Date.now()],
  });

  if (idempotent && result.rowsAffected === 0) {
    // 같은 요청이 동시에 두 번 들어와 다른 쪽이 먼저 저장됨 — 방금 만든 연동 일정은 고아가 되므로 지우고, 먼저 저장된 결과를 돌려준다.
    if (createdLinkedEvent && linkedEventId) {
      await turso.execute({ sql: 'DELETE FROM events WHERE id = ? AND user_id = ?', args: [linkedEventId, uid] });
    }
    const existing = await turso.execute({ sql: 'SELECT user_id, linked_event_id FROM todos WHERE id = ?', args: [id] });
    if (existing.rows.length === 0 || existing.rows[0].user_id !== uid) return NextResponse.json({ error: 'id conflict' }, { status: 409 });
    return NextResponse.json({ id, linkedEventId: existing.rows[0].linked_event_id || null, duplicate: true });
  }

  return NextResponse.json({ id, linkedEventId });
}
