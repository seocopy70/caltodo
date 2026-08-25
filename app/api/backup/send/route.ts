import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser, getUserEmail } from '../../../../lib/auth-server';
import { buildUserBackupJson } from '../../../../lib/backup';
import { sendBackupEmail } from '../../../../lib/email';

export async function POST(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const email = await getUserEmail(uid);
  if (!email) return NextResponse.json({ error: '로그인 계정의 이메일 주소를 확인할 수 없습니다.' }, { status: 400 });

  try {
    const backupJson = await buildUserBackupJson(uid);
    const filename = `cal2do-backup-${Date.now()}.json`;
    await sendBackupEmail(email, backupJson, filename);

    const now = Date.now();
    await turso.execute({
      sql: `INSERT INTO backup_settings (user_id, frequency, last_sent_at, updated_at) VALUES (?, 'off', ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET last_sent_at = excluded.last_sent_at, updated_at = excluded.updated_at`,
      args: [uid, now, now],
    });

    return NextResponse.json({ ok: true, sentTo: email });
  } catch (err: any) {
    console.error('백업 이메일 발송 실패:', err);
    return NextResponse.json({ error: err.message || '이메일 발송에 실패했습니다.' }, { status: 500 });
  }
}
