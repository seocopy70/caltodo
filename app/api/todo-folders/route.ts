import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({
    sql: 'SELECT * FROM todo_folders WHERE user_id = ? ORDER BY order_index ASC, created_at ASC',
    args: [uid],
  });

  const folders = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    orderIndex: Number(row.order_index || 0),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    color: row.color || null,
  }));

  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: '폴더 이름을 입력하세요.' }, { status: 400 });

  const id = randomUUID();
  const now = Date.now();
  await turso.execute({
    sql: 'INSERT INTO todo_folders (id, user_id, name, order_index, created_at, color) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, uid, name, body.orderIndex ?? now, now, body.color || null],
  });

  return NextResponse.json({ id });
}
