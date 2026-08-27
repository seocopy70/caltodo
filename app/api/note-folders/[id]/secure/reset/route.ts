import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../../../lib/turso';
import { verifyRequestUser, getUserEmail } from '../../../../../../lib/auth-server';
import { hashCodeServer, generateResetCode } from '../../../../../../lib/serverHash';
import { sendSecureFolderResetEmail } from '../../../../../../lib/email';

const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15분

async function getFolder(id: string, uid: string) {
  const result = await turso.execute({ sql: 'SELECT * FROM note_folders WHERE id = ? AND user_id = ?', args: [id, uid] });
  return (result.rows[0] as any) || null;
}

// 인증코드 이메일 요청 (잠긴 보안폴더도 요청 가능해야 복구가 됨)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const folder = await getFolder(params.id, uid);
  if (!folder || !folder.is_secure) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const email = await getUserEmail(uid);
  if (!email) return NextResponse.json({ error: '로그인 계정의 이메일 주소를 확인할 수 없습니다.' }, { status: 400 });

  const code = generateResetCode();
  await turso.execute({
    sql: 'UPDATE note_folders SET reset_code_hash = ?, reset_code_expires_at = ? WHERE id = ?',
    args: [hashCodeServer(code), Date.now() + RESET_CODE_TTL_MS, params.id],
  });

  try {
    await sendSecureFolderResetEmail(email, code);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '이메일 발송에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: email });
}

// 인증코드 확인 + 새 PIN/패턴 설정
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const folder = await getFolder(params.id, uid);
  if (!folder || !folder.is_secure) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json();
  const code = String(body.code || '');
  const newLockType = body.newLockType === 'pattern' ? 'pattern' : 'pin';
  const newCode = String(body.newCode || '');

  if (!folder.reset_code_hash || !folder.reset_code_expires_at || Date.now() > Number(folder.reset_code_expires_at)) {
    return NextResponse.json({ error: '인증코드가 만료되었어요. 다시 요청해주세요.' }, { status: 400 });
  }
  if (hashCodeServer(code) !== folder.reset_code_hash) {
    return NextResponse.json({ error: '인증코드가 맞지 않아요.' }, { status: 400 });
  }
  if (newCode.length < 4) return NextResponse.json({ error: '새 PIN/패턴이 너무 짧습니다.' }, { status: 400 });

  await turso.execute({
    sql: 'UPDATE note_folders SET lock_type = ?, lock_hash = ?, failed_attempts = 0, is_locked = 0, reset_code_hash = NULL, reset_code_expires_at = NULL WHERE id = ?',
    args: [newLockType, hashCodeServer(newCode), params.id],
  });
  return NextResponse.json({ ok: true });
}
