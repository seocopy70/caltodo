import { turso } from './turso';

/** bootstrap API와 동일한 형태로 한 사용자의 events/todos/notes를 모두 모아 백업 JSON 문자열로 만든다. */
export async function buildUserBackupJson(uid: string): Promise<string> {
  const [eventsResult, todosResult, notesResult] = await Promise.all([
    turso.execute({ sql: 'SELECT * FROM events WHERE user_id = ? ORDER BY start ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM todos WHERE user_id = ? ORDER BY completed ASC, order_index ASC, created_at ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC', args: [uid] }),
  ]);

  const events = eventsResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    start: new Date(Number(row.start)).toISOString(),
    end: new Date(Number(row.end)).toISOString(),
    endDate: row.end_date == null ? null : new Date(Number(row.end_date)).toISOString(),
    location: row.location || '',
    description: row.description || '',
    color: row.color || 'blue',
    recurrenceType: row.recurrence_type || 'none',
    source: row.source || null,
    externalUid: row.external_uid || null,
  }));

  const todos = todosResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    priority: row.priority || null,
    dueDate: row.due_date ? new Date(Number(row.due_date)).toISOString() : null,
    completedAt: row.completed_at ? new Date(Number(row.completed_at)).toISOString() : null,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    memo: row.memo || '',
  }));

  const notes = notesResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content || '',
    showToday: Number(row.show_today || 0) === 1,
    folderId: row.folder_id || null,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
    deletedAt: null,
  }));

  const backup = { version: 1, exportedAt: new Date().toISOString(), events, todos, notes };
  return JSON.stringify(backup, null, 2);
}
