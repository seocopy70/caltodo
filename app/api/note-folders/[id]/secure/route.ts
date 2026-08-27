import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../../lib/turso';
import { verifyRequestUser } from '../../../../../lib/auth-server';
import { hashCodeServer } from '../../../../../lib/serverHash';

const MAX_ATTEMPTS = 5;

async function getFolder(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT * FROM note_folders WHERE id = ? AND user_id = ?', args: [id, uid] });
  return (result.rows[0] as any) || null;
}

// 보안폴더로 최초 지정 (사용자당 1개만 허용)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const folder = await getFolder(params.id, uid);
  if (!folder) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const lockType = body.lockType === 'pattern' ? 'pattern' : 'pin';
  const code = String(body.code || '');
  if (code.length < 4) return NextResponse.json({ error: 'PIN/패턴이 너무 짧습니다.' }, { status: 400 });

  const existing = await turso.execute({ sql: 'SELECT id FROM note_folders WHERE user_id = ? AND is_secure = 1 AND id != ?', args: [uid, params.id] });
  if (existing.rows.length > 0) return NextResponse.json({ error: '이미 다른 폴더가 보안폴더로 지정되어 있어요. 보안폴더는 1개만 만들 수 있어요.' }, { status: 400 });

  await turso.execute({
    sql: 'UPDATE note_folders SET is_secure = 1, lock_type = ?, lock_hash = ?, failed_attempts = 0, is_locked = 0, reset_code_hash = NULL, reset_code_expires_at = NULL WHERE id = ?',
    args: [lockType, hashCodeServer(code), params.id],
  });
  return NextResponse.json({ ok: true });
}

// PIN/패턴 검증
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const folder = await getFolder(params.id, uid);
  if (!folder || !folder.is_secure) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (Number(folder.is_locked || 0) === 1) {
    return NextResponse.json({ ok: false, locked: true });
  }

  const body = await req.json();
  const code = String(body.code || '');
  const match = hashCodeServer(code) === folder.lock_hash;

  if (match) {
    await turso.execute({ sql: 'UPDATE note_folders SET failed_attempts = 0 WHERE id = ?', args: [params.id] });
    return NextResponse.json({ ok: true });
  }

  const attempts = Number(folder.failed_attempts || 0) + 1;
  const nowLocked = attempts >= MAX_ATTEMPTS;
  await turso.execute({
    sql: 'UPDATE note_folders SET failed_attempts = ?, is_locked = ? WHERE id = ?',
    args: [attempts, nowLocked ? 1 : 0, params.id],
  });
  return NextResponse.json({ ok: false, locked: nowLocked, remaining: Math.max(0, MAX_ATTEMPTS - attempts) });
}

// 보안폴더 해제 (현재 PIN/패턴 재확인 필요)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const folder = await getFolder(params.id, uid);
  if (!folder || !folder.is_secure) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const code = String(body.code || '');
  if (!Number(folder.is_locked) && hashCodeServer(code) !== folder.lock_hash) {
    return NextResponse.json({ error: '비밀번호/패턴이 맞지 않아요.' }, { status: 403 });
  }

  await turso.execute({
    sql: 'UPDATE note_folders SET is_secure = 0, lock_type = NULL, lock_hash = NULL, failed_attempts = 0, is_locked = 0, reset_code_hash = NULL, reset_code_expires_at = NULL WHERE id = ?',
    args: [params.id],
  });
  return NextResponse.json({ ok: true });
}
