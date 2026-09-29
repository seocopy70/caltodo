export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../../lib/turso';

async function syncYear(year: number) {
  const key = process.env.HOLIDAY_API_KEY;
  if (!key) throw new Error('HOLIDAY_API_KEY is not configured');

  const url = new URL('https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo');
  url.searchParams.set('ServiceKey', key);
  url.searchParams.set('solYear', String(year));
  url.searchParams.set('_type', 'json');
  url.searchParams.set('numOfRows', '100');

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`holiday API HTTP ${response.status}`);
  const json = await response.json();
  const raw = json?.response?.body?.items?.item;
  const items = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  const holidays = items
    .filter((item: any) => item?.isHoliday === 'Y' && item?.locdate)
    .map((item: any) => ({
      date: String(item.locdate).replace(/^(\\d{4})(\\d{2})(\\d{2})$/, '$1-$2-$3'),
      name: String(item.dateName || '공휴일'),
    }));

  const now = Date.now();
  await turso.execute({
    sql: `
      CREATE TABLE IF NOT EXISTS public_holidays (
        date TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
  });

  for (const holiday of holidays) {
    await turso.execute({
      sql: `
        INSERT INTO public_holidays (date, name, source, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          name = excluded.name,
          source = excluded.source,
          updated_at = excluded.updated_at
      `,
      args: [holiday.date, holiday.name, 'data.go.kr/한국천문연구원', now],
    });
  }

  return holidays.length;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const counts: Record<number, number> = {};
  const errors: Record<number, string> = {};

  for (const year of years) {
    try {
      counts[year] = await syncYear(year);
    } catch (error: any) {
      errors[year] = error?.message || String(error);
    }
  }

  return NextResponse.json({ years, counts, errors });
}
