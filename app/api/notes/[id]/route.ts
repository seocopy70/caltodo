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
  const existing = await turso.execute({ sql: 'SELECT folder_id, format, locked, lock_type, lock_hash FROM notes WHERE id = ?', args: [params.id] });
  const existingRow: any = existing.rows[0] || {};
  // 명시적으로 안 보낸 필드(예: 오늘탭 인라인 저장)는 기존 값을 그대로 유지
  const folderId = body.folderId !== undefined ? (body.folderId || null) : (existingRow.folder_id || null);
  const format = body.format !== undefined ? (body.format || 'plain') : (existingRow.format || 'plain');
  const locked = body.locked !== undefined ? (body.locked ? 1 : 0) : Number(existingRow.locked || 0);
  const lockType = body.locked !== undefined ? (body.locked ? (body.lockType || null) : null) : (existingRow.lock_type || null);
  const lockHash = body.locked !== undefined ? (body.locked ? (body.lockHash || null) : null) : (existingRow.lock_hash || null);

  await turso.execute({
    sql: 'UPDATE notes SET title = ?, content = ?, updated_at = ?, show_today = ?, folder_id = ?, format = ?, locked = ?, lock_type = ?, lock_hash = ? WHERE id = ? AND deleted_at IS NULL',
    args: [body.title || '(제목 없음)', body.content || '', Date.now(), body.showToday ? 1 : 0, folderId, format, locked, lockType, lockHash, params.id],
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
