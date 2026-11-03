import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';
import { isValidClientId } from '../../../lib/client-id';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const includeDeleted = new URL(req.url).searchParams.get('includeDeleted') === 'true';
  const result = await turso.execute({
    sql: includeDeleted
      ? 'SELECT n.* FROM notes n LEFT JOIN note_folders f ON f.id = n.folder_id AND f.user_id = n.user_id WHERE n.user_id = ? AND COALESCE(f.is_secure, 0) = 0 ORDER BY n.deleted_at IS NOT NULL, n.updated_at DESC'
      : 'SELECT n.* FROM notes n LEFT JOIN note_folders f ON f.id = n.folder_id AND f.user_id = n.user_id WHERE n.user_id = ? AND n.deleted_at IS NULL AND COALESCE(f.is_secure, 0) = 0 ORDER BY n.updated_at DESC',
    args: [uid],
  });

  const notes = result.rows.map((row: any) => ({
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

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  // 백업 복원 시엔 원래 id를 그대로 유지 (재가져오기해도 중복되지 않도록)
  const id = body.id || randomUUID();
  // 새 메모를 만들 때 앱이 미리 정한 id를 보내면(idempotent) "한 번만" 저장한다: 같은 요청이 다시 와도(저장 직후 앱이 꺼져
  // 응답을 못 받고 재전송한 경우 등) 중복으로 만들지도, 그 사이 고친 내용을 옛 값으로 되돌리지도 않는다.
  // (백업 복원처럼 id만 주는 기존 호출은 예전처럼 덮어쓰기)
  const idempotent = body.idempotent === true && isValidClientId(body.id);
  if (body.idempotent === true && !idempotent) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const now = Date.now();
  const createdAt = body.createdAt ? new Date(body.createdAt).getTime() : now;
  const updatedAt = body.updatedAt ? new Date(body.updatedAt).getTime() : now;
  const deletedAt = body.deletedAt ? new Date(body.deletedAt).getTime() : null;

  const result = await turso.execute({
    sql: `${idempotent ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE'} INTO notes (id, user_id, title, content, created_at, updated_at, deleted_at, show_today, folder_id, format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, uid, body.title || '(제목 없음)', body.content || '', createdAt, updatedAt, deletedAt, body.showToday ? 1 : 0, body.folderId || null, body.format || 'plain'],
  });

  if (idempotent && result.rowsAffected === 0) {
    // 이미 같은 id가 있음 — 내 항목이면 이미 저장된 것(성공), 남의 항목이면 거절
    const own = await turso.execute({ sql: 'SELECT user_id FROM notes WHERE id = ?', args: [id] });
    if (own.rows.length === 0 || own.rows[0].user_id !== uid) return NextResponse.json({ error: 'id conflict' }, { status: 409 });
    return NextResponse.json({ id, duplicate: true });
  }

  return NextResponse.json({ id });
}
