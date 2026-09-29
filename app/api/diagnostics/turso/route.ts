import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { turso } from '../../../../lib/turso';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL || '';
  const token = process.env.TURSO_AUTH_TOKEN || '';

  const safeUrl = (() => {
    try {
      const u = new URL(url);
      return { protocol: u.protocol, host: u.host, pathname: u.pathname };
    } catch {
      return { invalid: true };
    }
  })();

  const tokenFingerprint = token
    ? createHash('sha256').update(token).digest('hex').slice(0, 12)
    : null;

  let tursoTest: { ok: boolean; status?: string; error?: string } = { ok: false };

  try {
    await turso.execute('SELECT 1');
    tursoTest = { ok: true };
  } catch (error: any) {
    tursoTest = {
      ok: false,
      status: error?.cause?.status ? String(error.cause.status) : undefined,
      error: error?.message ? String(error.message).slice(0, 180) : 'unknown error',
    };
  }

  return NextResponse.json({
    environment: 'preview-diagnostic',
    databaseUrl: safeUrl,
    authToken: {
      present: Boolean(token),
      length: token.length,
      fingerprint: tokenFingerprint,
    },
    tursoTest,
  });
}
