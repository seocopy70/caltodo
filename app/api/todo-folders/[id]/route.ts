import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';

async function assertOwnership(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT user_id FROM todo_folders WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return false;
  return result.rows[0].user_id === uid;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: '폴더 이름을 입력하세요.' }, { status: 400 });

  await turso.execute({ sql: 'UPDATE todo_folders SET name = ? WHERE id = ?', args: [name, params.id] });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 폴더를 지워도 할일 자체는 삭제하지 않고 '미분류'로 되돌림
  await turso.execute({ sql: 'UPDATE todos SET folder_id = NULL WHERE folder_id = ? AND user_id = ?', args: [params.id, uid] });
  await turso.execute({ sql: 'DELETE FROM todo_folders WHERE id = ?', args: [params.id] });
  return NextResponse.json({ ok: true });
}
