import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';

async function assertOwnership(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT user_id FROM notes WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return false;
  return result.rows[0].user_id === uid;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  // folderId를 명시적으로 안 보낸 요청(예: 오늘탭 인라인 저장)은 기존 폴더 배정을 유지
  let folderId: string | null = null;
  if (body.folderId !== undefined) {
    folderId = body.folderId || null;
  } else {
    const existing = await turso.execute({ sql: 'SELECT folder_id FROM notes WHERE id = ?', args: [params.id] });
    folderId = (existing.rows[0]?.folder_id as string) || null;
  }
  await turso.execute({
    sql: 'UPDATE notes SET title = ?, content = ?, updated_at = ?, show_today = ?, folder_id = ? WHERE id = ? AND deleted_at IS NULL',
    args: [body.title || '(제목 없음)', body.content || '', Date.now(), body.showToday ? 1 : 0, folderId, params.id],
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await turso.execute({ sql: 'UPDATE notes SET deleted_at = ?, show_today = 0 WHERE id = ?', args: [Date.now(), params.id] });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await assertOwnership(params.id, uid))) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  if (body.action === 'restore') {
    await turso.execute({ sql: 'UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?', args: [Date.now(), params.id] });
  } else if (body.action === 'purge') {
    await turso.execute({ sql: 'DELETE FROM notes WHERE id = ?', args: [params.id] });
  } else {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
