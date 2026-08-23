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
  }));

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const id = randomUUID();
  const now = Date.now();

  await turso.execute({
    sql: `INSERT INTO notes (id, user_id, title, content, created_at, updated_at, deleted_at, show_today) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    args: [id, uid, body.title || '(제목 없음)', body.content || '', now, now, body.showToday ? 1 : 0],
  });

  return NextResponse.json({ id });
}
