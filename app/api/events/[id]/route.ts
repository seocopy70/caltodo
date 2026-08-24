import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';
import { syncLinkedTodo, unlinkTodoEvent } from '../../../../lib/linking';

async function getEvent(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return null;
  const row: any = result.rows[0];
  if (row.user_id !== uid) return null;
  return row;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await getEvent(params.id, uid);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const newStart = new Date(body.start).getTime();
  const linkedTodoId: string | null = existing.linked_todo_id || null;

  // 반복설정 또는 다중일(종일 범위 지정)로 바뀌면 할일과는 더 이상 호환되지 않으므로 연동 해제
  const becomesIncompatible = (body.recurrenceType && body.recurrenceType !== 'none') || !!body.endDate;
  let clearLink = false;

  if (linkedTodoId) {
    if (becomesIncompatible) {
      await unlinkTodoEvent(uid, linkedTodoId, null);
      clearLink = true;
    } else {
      // 날짜/제목 변경은 호환되는 수정 -> 연동된 할일에도 반영
      await syncLinkedTodo(uid, linkedTodoId, { title: body.title, dueDateMs: newStart });
    }
  }

  await turso.execute({
    sql: `UPDATE events SET title=?, start=?, end_time=?, end_date=?, location=?, description=?, color=?, recurrence_type=?, updated_at=?${clearLink ? ', linked_todo_id=NULL' : ''} WHERE id=?`,
    args: [
      body.title,
      newStart,
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

  return NextResponse.json({ ok: true, unlinked: clearLink });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await getEvent(params.id, uid);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 연동된 할일이 있으면 날짜만 지우고(연동 해제) 할일 자체는 남긴다.
  if (existing.linked_todo_id) {
    await turso.execute({ sql: 'UPDATE todos SET due_date = NULL, linked_event_id = NULL WHERE id = ? AND user_id = ?', args: [existing.linked_todo_id, uid] });
  }

  await turso.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [params.id] });
  return NextResponse.json({ ok: true });
}
