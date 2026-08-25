import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const includeDeleted = new URL(req.url).searchParams.get('includeDeleted') === 'true';
  const result = await turso.execute({
    sql: includeDeleted
      ? 'SELECT * FROM notes WHERE user_id = ? ORDER BY deleted_at IS NOT NULL, updated_at DESC'
      : 'SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
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
  }));

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  // 백업 복원 시엔 원래 id를 그대로 유지 (재가져오기해도 중복되지 않도록)
  const id = body.id || randomUUID();
  const now = Date.now();
  const createdAt = body.createdAt ? new Date(body.createdAt).getTime() : now;
  const updatedAt = body.updatedAt ? new Date(body.updatedAt).getTime() : now;
  const deletedAt = body.deletedAt ? new Date(body.deletedAt).getTime() : null;

  await turso.execute({
    sql: `INSERT OR REPLACE INTO notes (id, user_id, title, content, created_at, updated_at, deleted_at, show_today, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, uid, body.title || '(제목 없음)', body.content || '', createdAt, updatedAt, deletedAt, body.showToday ? 1 : 0, body.folderId || null],
  });

  return NextResponse.json({ id });
}
