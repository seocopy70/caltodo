import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';

// 앱 최초 로딩 시 events/todos/notes를 각각 따로 요청하면
// (1) Firebase 토큰 검증이 3번 일어나고 (2) 클라이언트-서버 왕복이 3번 생김.
// 이 라우트는 인증 검증 1번 + DB 조회 3개를 병렬로 묶어 왕복을 1번으로 줄인다.
export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [eventsResult, todosResult, notesResult, foldersResult, todoFoldersResult] = await Promise.all([
    turso.execute({ sql: 'SELECT * FROM events WHERE user_id = ? ORDER BY start ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM todos WHERE user_id = ? ORDER BY completed ASC, order_index ASC, created_at ASC', args: [uid] }),
    // 삭제된(휴지통) 메모는 평소엔 안 쓰는 데이터라 기본 로딩에서 빼고, 보관함을 실제로 열 때만 따로 불러옴
    turso.execute({ sql: 'SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM note_folders WHERE user_id = ? ORDER BY order_index ASC, created_at ASC', args: [uid] }).catch(() => ({ rows: [] as any[] })),
    turso.execute({ sql: 'SELECT * FROM todo_folders WHERE user_id = ? ORDER BY order_index ASC, created_at ASC', args: [uid] }).catch(() => ({ rows: [] as any[] })),
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
    recurrenceCount: row.recurrence_count == null ? null : Number(row.recurrence_count),
    isLunar: Number(row.is_lunar || 0) === 1,
    lunarMonth: row.lunar_month == null ? null : Number(row.lunar_month),
    lunarDay: row.lunar_day == null ? null : Number(row.lunar_day),
    isAnniversary: Number(row.is_anniversary || 0) === 1,
    source: row.source || 'manual',
    externalUid: row.external_uid || null,
    linkedTodoId: row.linked_todo_id || null,
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
    linkedEventId: row.linked_event_id || null,
    folderId: row.folder_id || null,
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
    folderId: row.folder_id || null,
    format: row.format || 'plain',
  }));

  const noteFolders = foldersResult.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    orderIndex: Number(row.order_index || 0),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    isSecure: Number(row.is_secure || 0) === 1,
    lockType: row.lock_type || null,
    isLocked: Number(row.is_locked || 0) === 1,
    color: row.color || null,
  }));

  const todoFolders = todoFoldersResult.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    orderIndex: Number(row.order_index || 0),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    color: row.color || null,
  }));

  return NextResponse.json({ events, todos, notes, noteFolders, todoFolders });
}
