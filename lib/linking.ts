import { turso } from './turso';
import { randomUUID } from 'crypto';

/**
 * 할일에 날짜(dueDate)가 생기면 캘린더에도 보이도록 연동된 일정을 만든다.
 * 반환값: 새로 생성된 이벤트 id
 */
export async function createLinkedEventForTodo(uid: string, title: string, dueDateMs: number) {
  const eventId = randomUUID();
  const end = dueDateMs + 30 * 60 * 1000;
  await turso.execute({
    sql: `INSERT INTO events (id, user_id, title, start, end_time, end_date, location, description, color, recurrence_type, updated_at, source, external_uid, linked_todo_id)
          VALUES (?, ?, ?, ?, ?, NULL, '', '', 'blue', 'none', ?, 'todo_link', NULL, ?)`,
    args: [eventId, uid, title, dueDateMs, end, Date.now(), null],
  });
  return eventId;
}

/** 연동된 일정의 날짜/제목을 할일 쪽 변경사항에 맞춰 갱신 */
export async function syncLinkedEvent(uid: string, eventId: string, opts: { title?: string; dueDateMs?: number }) {
  const sets: string[] = [];
  const args: any[] = [];
  if (opts.title !== undefined) { sets.push('title = ?'); args.push(opts.title); }
  if (opts.dueDateMs !== undefined) {
    sets.push('start = ?'); args.push(opts.dueDateMs);
    sets.push('end_time = ?'); args.push(opts.dueDateMs + 30 * 60 * 1000);
  }
  sets.push('updated_at = ?'); args.push(Date.now());
  if (sets.length === 0) return;
  args.push(eventId, uid);
  await turso.execute({ sql: `UPDATE events SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, args });
}

/** 연동된 할일의 날짜/제목을 일정 쪽 변경사항에 맞춰 갱신 (호환되는 수정일 때만 호출) */
export async function syncLinkedTodo(uid: string, todoId: string, opts: { title?: string; dueDateMs?: number }) {
  const sets: string[] = [];
  const args: any[] = [];
  if (opts.title !== undefined) { sets.push('title = ?'); args.push(opts.title); }
  if (opts.dueDateMs !== undefined) { sets.push('due_date = ?'); args.push(opts.dueDateMs); }
  if (sets.length === 0) return;
  args.push(todoId, uid);
  await turso.execute({ sql: `UPDATE todos SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, args });
}

/** 할일-일정 연동을 해제 (양쪽 id 참조만 지움, 각자 데이터는 그대로 유지) */
export async function unlinkTodoEvent(uid: string, todoId: string | null, eventId: string | null) {
  if (todoId) await turso.execute({ sql: 'UPDATE todos SET linked_event_id = NULL WHERE id = ? AND user_id = ?', args: [todoId, uid] });
  if (eventId) await turso.execute({ sql: 'UPDATE events SET linked_todo_id = NULL WHERE id = ? AND user_id = ?', args: [eventId, uid] });
}
