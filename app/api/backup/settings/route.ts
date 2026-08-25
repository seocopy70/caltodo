import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';
import { verifyRequestUser } from '../../../../lib/auth-server';

const VALID = ['off', 'daily', 'weekly', 'monthly'];

export async function GET(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await turso.execute({ sql: 'SELECT * FROM backup_settings WHERE user_id = ?', args: [uid] });
  const row = result.rows[0] as any;
  return NextResponse.json({
    frequency: row?.frequency || 'off',
    lastSentAt: row?.last_sent_at ? new Date(Number(row.last_sent_at)).toISOString() : null,
  });
}

export async function PUT(req: NextRequest) {
  const uid = await verifyRequestUser(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const frequency = String(body.frequency || 'off');
  if (!VALID.includes(frequency)) return NextResponse.json({ error: '잘못된 주기 값입니다.' }, { status: 400 });

  const now = Date.now();
  await turso.execute({
    sql: `INSERT INTO backup_settings (user_id, frequency, last_sent_at, updated_at) VALUES (?, ?, NULL, ?)
          ON CONFLICT(user_id) DO UPDATE SET frequency = excluded.frequency, updated_at = excluded.updated_at`,
    args: [uid, frequency, now],
  });

  return NextResponse.json({ ok: true });
}
