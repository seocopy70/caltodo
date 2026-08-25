import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { getUserEmail } from '../../../../lib/auth-server';
import { buildUserBackupJson } from '../../../../lib/backup';
import { sendBackupEmail } from '../../../../lib/email';

const INTERVAL_MS: Record<string, number> = {
  daily: 20 * 60 * 60 * 1000, // 20시간 지나면 다음 실행 때 발송 (하루 한 번 크론과 맞물림)
  weekly: 6.5 * 24 * 60 * 60 * 1000,
  monthly: 27 * 24 * 60 * 60 * 1000,
};

// Vercel Cron이 매일 호출. Authorization: Bearer <CRON_SECRET> 헤더로 검증.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const result = await turso.execute({
    sql: `SELECT * FROM backup_settings WHERE frequency IN ('daily','weekly','monthly')`,
  });

  const now = Date.now();
  let sent = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const row of result.rows as any[]) {
    const uid = row.user_id as string;
    const frequency = row.frequency as string;
    const lastSentAt = row.last_sent_at ? Number(row.last_sent_at) : 0;
    const interval = INTERVAL_MS[frequency];
    if (!interval || now - lastSentAt < interval) continue;

    try {
      const email = await getUserEmail(uid);
      if (!email) throw new Error('이메일 없음');
      const backupJson = await buildUserBackupJson(uid);
      const filename = `cal2do-backup-${now}.json`;
      await sendBackupEmail(email, backupJson, filename);
      await turso.execute({
        sql: 'UPDATE backup_settings SET last_sent_at = ?, updated_at = ? WHERE user_id = ?',
        args: [now, now, uid],
      });
      sent++;
    } catch (err: any) {
      failed++;
      errors.push({ uid, error: err.message || String(err) });
      console.error(`[cron/backup] ${uid} 발송 실패:`, err);
    }
  }

  return NextResponse.json({ checked: result.rows.length, sent, failed, errors });
}
