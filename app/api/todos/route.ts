import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({
    sql: 'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
    args: [uid],
  });

  const todos = result.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    dueDate: row.due_date ? new Date(Number(row.due_date)).toISOString() : null,
    memo: row.memo,
    createdAt: new Date(Number(row.created_at)).toISOString(),
  }));

  return NextResponse.json({ todos });
}

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const id = randomUUID();

  await turso.execute({
    sql: `INSERT INTO todos (id, user_id, title, completed, due_date, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, uid, body.title, body.completed ? 1 : 0, body.dueDate ? new Date(body.dueDate).getTime() : null, body.memo || '', Date.now()],
  });

  return NextResponse.json({ id });
}
