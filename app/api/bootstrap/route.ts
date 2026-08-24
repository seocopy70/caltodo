import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';

// 앱 최초 로딩 시 events/todos/notes를 각각 따로 요청하면
// (1) Firebase 토큰 검증이 3번 일어나고 (2) 클라이언트-서버 왕복이 3번 생김.
// 이 라우트는 인증 검증 1번 + DB 조회 3개를 병렬로 묶어 왕복을 1번으로 줄인다.
export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [eventsResult, todosResult, notesResult] = await Promise.all([
    turso.execute({ sql: 'SELECT * FROM events WHERE user_id = ? ORDER BY start ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM todos WHERE user_id = ? ORDER BY completed ASC, order_index ASC, created_at ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM notes WHERE user_id = ? ORDER BY deleted_at IS NOT NULL, updated_at DESC', args: [uid] }),
  ]);

  const events = eventsResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    start: new Date(Number(row.start)).toISOString(),
    end: new Date(Number(row.end_time)).toISOString(),
    endDate: row.end_date ? new Date(Number(row.end_date)).toISOString() : null,
    location: row.location,
    description: row.description,
    color: row.color,
    recurrenceType: row.recurrence_type,
    source: row.source || 'manual',
    externalUid: row.external_uid || null,
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  }));

  const todos = todosResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    dueDate: row.due_date ? new Date(Number(row.due_date)).toISOString() : null,
    memo: row.memo,
    orderIndex: Number(row.order_index || 0),
    priority: row.priority || null,
    completedAt: row.completed_at ? new Date(Number(row.completed_at)).toISOString() : null,
    createdAt: new Date(Number(row.created_at)).toISOString(),
  }));

  const notes = notesResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
    deletedAt: row.deleted_at == null ? null : new Date(Number(row.deleted_at)).toISOString(),
    showToday: Number(row.show_today || 0) === 1,
  }));

  return NextResponse.json({ events, todos, notes });
}
