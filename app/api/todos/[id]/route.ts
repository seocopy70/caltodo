import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';
import { createLinkedEventForTodo, syncLinkedEvent } from '../../../../lib/linking';

async function getTodo(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return null;
  const row: any = result.rows[0];
  if (row.user_id !== uid) return null;
  return row;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await getTodo(params.id, uid);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const sets: string[] = [];
  const args: any[] = [];

  if (body.title !== undefined) { sets.push('title = ?'); args.push(body.title); }
  if (body.completed !== undefined) {
    sets.push('completed = ?'); args.push(body.completed ? 1 : 0);
    sets.push('completed_at = ?'); args.push(body.completed ? Date.now() : null);
  }
  if (body.memo !== undefined) { sets.push('memo = ?'); args.push(body.memo); }
  if (body.orderIndex !== undefined) { sets.push('order_index = ?'); args.push(Number(body.orderIndex)); }
  if (body.folderId !== undefined) { sets.push('folder_id = ?'); args.push(body.folderId || null); }
  if (body.priority !== undefined) {
    sets.push('priority = ?'); args.push(body.priority || null);
    if (body.priority && body.bumpToTop) {
      const minResult = await turso.execute({ sql: 'SELECT COALESCE(MIN(order_index), 1) AS min_order FROM todos WHERE user_id = ?', args: [uid] });
      sets.push('order_index = ?'); args.push(Number(minResult.rows[0]?.min_order ?? 1) - 1);
    }
  }

  // 날짜(dueDate) 변경 -> 연동된 일정과 동기화
  let linkedEventId: string | null = existing.linked_event_id || null;
  if (body.dueDate !== undefined) {
    const newDueMs = body.dueDate ? new Date(body.dueDate).getTime() : null;
    sets.push('due_date = ?'); args.push(newDueMs);

    if (newDueMs === null && linkedEventId) {
      // 날짜 제거 -> 연동된 일정 삭제 + 연동 해제
      await turso.execute({ sql: 'DELETE FROM events WHERE id = ? AND user_id = ?', args: [linkedEventId, uid] });
      linkedEventId = null;
      sets.push('linked_event_id = ?'); args.push(null);
    } else if (newDueMs !== null && linkedEventId) {
      // 날짜 변경 -> 연동된 일정 날짜도 동기화
      await syncLinkedEvent(uid, linkedEventId, { title: body.title, dueDateMs: newDueMs });
    } else if (newDueMs !== null && !linkedEventId) {
      // 날짜가 새로 생김 -> 사용자가 연동을 원할 때만(skipLink가 아닐 때만) 연동 일정 새로 생성
      if (!body.skipLink) {
        linkedEventId = await createLinkedEventForTodo(uid, body.title ?? existing.title, newDueMs);
        sets.push('linked_event_id = ?'); args.push(linkedEventId);
      }
    }
  } else if (body.title !== undefined && linkedEventId) {
    // 날짜는 그대로, 제목만 변경 -> 연동된 일정 제목도 동기화
    await syncLinkedEvent(uid, linkedEventId, { title: body.title });
  }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  args.push(params.id);
  await turso.execute({ sql: `UPDATE todos SET ${sets.join(', ')} WHERE id = ?`, args });

  return NextResponse.json({ ok: true, linkedEventId });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await getTodo(params.id, uid);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (existing.linked_event_id) {
    await turso.execute({ sql: 'DELETE FROM events WHERE id = ? AND user_id = ?', args: [existing.linked_event_id, uid] });
  }
  await turso.execute({ sql: 'DELETE FROM todos WHERE id = ?', args: [params.id] });
  return NextResponse.json({ ok: true });
}
