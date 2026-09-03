import { turso } from './turso';

// 값이 없거나 잘못된 타임스탬프여도 죽지 않도록 안전하게 ISO 문자열로 변환 (실패 시 null)
function safeIso(value: any): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** bootstrap API와 동일한 형태로 한 사용자의 events/todos/notes/note_folders를 모두 모아 백업 JSON 문자열로 만든다. */
export async function buildUserBackupJson(uid: string): Promise<string> {
  const [eventsResult, todosResult, notesResult, foldersResult, todoFoldersResult] = await Promise.all([
    turso.execute({ sql: 'SELECT * FROM events WHERE user_id = ? ORDER BY start ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM todos WHERE user_id = ? ORDER BY completed ASC, order_index ASC, created_at ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM note_folders WHERE user_id = ? ORDER BY order_index ASC, created_at ASC', args: [uid] }),
    turso.execute({ sql: 'SELECT * FROM todo_folders WHERE user_id = ? ORDER BY order_index ASC, created_at ASC', args: [uid] }).catch(() => ({ rows: [] as any[] })),
  ]);

  const events = eventsResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    start: safeIso(row.start),
    end: safeIso(row.end_time),
    endDate: safeIso(row.end_date),
    location: row.location || '',
    description: row.description || '',
    color: row.color || 'blue',
    recurrenceType: row.recurrence_type || 'none',
    recurrenceCount: row.recurrence_count == null ? null : Number(row.recurrence_count),
    isLunar: Number(row.is_lunar || 0) === 1,
    lunarMonth: row.lunar_month == null ? null : Number(row.lunar_month),
    lunarDay: row.lunar_day == null ? null : Number(row.lunar_day),
    isAnniversary: Number(row.is_anniversary || 0) === 1,
    source: row.source || null,
    externalUid: row.external_uid || null,
  }));

  const todos = todosResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    priority: row.priority || null,
    dueDate: safeIso(row.due_date),
    completedAt: safeIso(row.completed_at),
    createdAt: safeIso(row.created_at),
    memo: row.memo || '',
    folderId: row.folder_id || null,
  }));

  const notes = notesResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content || '',
    showToday: Number(row.show_today || 0) === 1,
    folderId: row.folder_id || null,
    format: row.format || 'plain',
    createdAt: safeIso(row.created_at),
    updatedAt: safeIso(row.updated_at),
    deletedAt: null,
  }));

  // 폴더 이름/순서는 백업에 포함하되, lock_hash/reset_code 등 보안 관련 값은 절대 포함하지 않음
  // (백업 파일이 외부로 유출될 경우 PIN/패턴 해시가 오프라인 무차별 대입에 노출될 수 있기 때문).
  // 보안폴더였다는 사실(wasSecure)만 남겨서, 복원 후 다시 PIN을 설정하라고 안내하는 데 사용.
  const noteFolders = foldersResult.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    orderIndex: Number(row.order_index || 0),
    wasSecure: Number(row.is_secure || 0) === 1,
    color: row.color || null,
  }));

  const todoFolders = todoFoldersResult.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    orderIndex: Number(row.order_index || 0),
    color: row.color || null,
  }));

  const backup = { version: 2, exportedAt: new Date().toISOString(), events, todos, notes, noteFolders, todoFolders };
  return JSON.stringify(backup, null, 2);
}
