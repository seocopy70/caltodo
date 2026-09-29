export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

type HolidayRow = { date: string; name: string; source: string };

async function ensureTable() {
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
}

async function fetchGovernmentHolidays(year: number): Promise<HolidayRow[]> {
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
  const body = json?.response?.body;
  const raw = body?.items?.item;
  if (!raw) return [];

  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .filter((item: any) => item?.isHoliday === 'Y' && item?.locdate)
    .map((item: any) => ({
      date: String(item.locdate).replace(/^(\\d{4})(\\d{2})(\\d{2})$/, '$1-$2-$3'),
      name: String(item.dateName || '공휴일'),
      source: 'data.go.kr/한국천문연구원',
    }));
}

async function cacheYear(year: number) {
  const holidays = await fetchGovernmentHolidays(year);
  const now = Date.now();
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
      args: [holiday.date, holiday.name, holiday.source, now],
    });
  }

  // 정부 데이터에서 빠진 날짜가 삭제된 경우도 반영한다.
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const dates = new Set(holidays.map((h) => h.date));
  const existing = await turso.execute({
    sql: 'SELECT date FROM public_holidays WHERE date BETWEEN ? AND ? AND source = ?',
    args: [start, end, 'data.go.kr/한국천문연구원'],
  });
  for (const row of existing.rows as any[]) {
    if (!dates.has(String(row.date))) {
      await turso.execute({
        sql: 'DELETE FROM public_holidays WHERE date = ? AND source = ?',
        args: [row.date, 'data.go.kr/한국천문연구원'],
      });
    }
  }
  return holidays;
}

export async function GET(req: NextRequest) {
  await ensureTable();

  const yearsParam = req.nextUrl.searchParams.get('years') || String(new Date().getFullYear());
  const years = Array.from(new Set(
    yearsParam.split(',').map(Number).filter((year) => year >= 2000 && year <= 2100),
  )).slice(0, 5);

  const result: Record<string, string> = {};
  const missing: number[] = [];

  for (const year of years) {
    const rows = await turso.execute({
      sql: 'SELECT date, name FROM public_holidays WHERE date BETWEEN ? AND ?',
      args: [`${year}-01-01`, `${year}-12-31`],
    });
    if (rows.rows.length === 0) missing.push(year);
    for (const row of rows.rows as any[]) result[String(row.date)] = String(row.name);
  }

  // 캐시가 없는 연도만 정부 API에서 가져온다. 이후에는 DB 캐시를 사용한다.
  for (const year of missing) {
    try {
      await cacheYear(year);
      const rows = await turso.execute({
        sql: 'SELECT date, name FROM public_holidays WHERE date BETWEEN ? AND ?',
        args: [`${year}-01-01`, `${year}-12-31`],
      });
      for (const row of rows.rows as any[]) result[String(row.date)] = String(row.name);
    } catch (error: any) {
      console.error('[holidays] government sync failed:', error?.message || error);
    }
  }

  return NextResponse.json({ holidays: result, years, source: 'cache+data.go.kr' });
}
