import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';
import { verifyRequestUser } from '../../../lib/auth-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({
    sql: 'SELECT * FROM note_folders WHERE user_id = ? ORDER BY order_index ASC, created_at ASC',
    args: [uid],
  });

  const folders = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    orderIndex: Number(row.order_index || 0),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    isSecure: Number(row.is_secure || 0) === 1,
    lockType: row.lock_type || null,
    isLocked: Number(row.is_locked || 0) === 1,
    // lock_hash, reset_code_* 는 클라이언트로 절대 보내지 않음 (서버에서만 검증)
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
    sql: 'INSERT INTO note_folders (id, user_id, name, order_index, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, uid, name, body.orderIndex ?? now, now],
  });

  return NextResponse.json({ id });
}
