import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({
    sql: 'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
    args: [uid],
  });

  const notes = result.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
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
    sql: `INSERT INTO notes (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, uid, body.title || '(제목 없음)', body.content || '', now, now],
  });

  return NextResponse.json({ id });
}
