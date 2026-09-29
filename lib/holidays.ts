import KoreanLunarCalendar from 'korean-lunar-calendar';

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function lunarToSolarDate(year: number, month: number, day: number, isLeapMonth = false): Date {
  const cal = new KoreanLunarCalendar();
  cal.setLunarDate(year, month, day, isLeapMonth);
  const s = cal.getSolarCalendar();
  return new Date(s.year, s.month - 1, s.day);
}

/** 양력 날짜를 음력 (년,월,일)로 변환. 생일/기념일을 음력으로 저장할 때 사용. */
export function solarToLunar(date: Date): { year: number; month: number; day: number; isLeapMonth: boolean } {
  const cal = new KoreanLunarCalendar();
  cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const l = cal.getLunarCalendar();
  return { year: l.year, month: l.month, day: l.day, isLeapMonth: !!l.intercalation };
}

function addDaysDate(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * 대한민국 공휴일 데이터.
 *
 * 기준: 2026-05-11 시행 「공휴일에 관한 법률」 및
 * 「관공서의 공휴일에 관한 규정」.
 *
 * 대체공휴일은 단순히 "주말이면 다음 월요일"로 처리하지 않고,
 * 공휴일 종류별 법정 적용 조건과 "다음 첫 번째 비공휴일" 규칙을 반영한다.
 */
const SUBSTITUTE_SAT_SUN = new Set([
  '삼일절',
  '광복절',
  '개천절',
  '한글날',
  '부처님오신날',
  '노동절',
  '어린이날',
  '성탄절',
]);

const SUBSTITUTE_SUNDAY_ONLY = new Set([
  '설날 연휴',
  '설날',
  '추석 연휴',
  '추석',
]);

/** 주어진 연도의 대한민국 공휴일을 { 'YYYY-MM-DD': '이름' } 형태로 반환 */
export function getKoreanHolidays(year: number): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (date: Date, name: string) => {
    map[toKey(date.getFullYear(), date.getMonth() + 1, date.getDate())] = name;
  };

  // 고정 양력 공휴일
  add(new Date(year, 0, 1), '신정');
  add(new Date(year, 2, 1), '삼일절');
  add(new Date(year, 4, 1), '노동절');
  add(new Date(year, 4, 5), '어린이날');
  add(new Date(year, 5, 6), '현충일');
  add(new Date(year, 7, 15), '광복절');
  add(new Date(year, 9, 3), '개천절');
  add(new Date(year, 9, 9), '한글날');
  add(new Date(year, 11, 25), '성탄절');

  // 음력 기반 공휴일
  const seol = lunarToSolarDate(year, 1, 1);
  add(addDaysDate(seol, -1), '설날 연휴');
  add(seol, '설날');
  add(addDaysDate(seol, 1), '설날 연휴');

  const chuseok = lunarToSolarDate(year, 8, 15);
  add(addDaysDate(chuseok, -1), '추석 연휴');
  add(chuseok, '추석');
  add(addDaysDate(chuseok, 1), '추석 연휴');

  add(lunarToSolarDate(year, 4, 8), '부처님오신날');

  // 대체공휴일
  const originalHolidays = Object.entries(map);
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
  const isPublicHoliday = (date: Date) => !!map[toKey(date.getFullYear(), date.getMonth() + 1, date.getDate())];

  for (const [key, name] of originalHolidays) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay();

    const weekendTrigger =
      SUBSTITUTE_SAT_SUN.has(name)
        ? (dow === 0 || dow === 6)
        : SUBSTITUTE_SUNDAY_ONLY.has(name)
          ? dow === 0
          : false;

    // 서로 다른 공휴일이 겹치는 경우에도 대체공휴일 대상이다.
    const overlapTrigger = (() => {
      if (!SUBSTITUTE_SAT_SUN.has(name) && !SUBSTITUTE_SUNDAY_ONLY.has(name)) return false;
      const prior = addDaysDate(date, -1);
      const next = addDaysDate(date, 1);
      return isPublicHoliday(prior) || isPublicHoliday(next);
    })();

    if (!weekendTrigger && !overlapTrigger) continue;

    let next = addDaysDate(date, 1);
    while (isWeekend(next) || isPublicHoliday(next)) {
      next = addDaysDate(next, 1);
    }
    map[toKey(next.getFullYear(), next.getMonth() + 1, next.getDate())] = '대체공휴일';
  }

  return map;
}

/** 여러 연도의 공휴일 맵을 한 번에 합쳐서 반환 (월 그리드가 연도 경계를 넘을 때 사용) */
export function getKoreanHolidaysForYears(years: number[]): Record<string, string> {
  const merged: Record<string, string> = {};
  Array.from(new Set(years)).forEach((y) => Object.assign(merged, getKoreanHolidays(y)));
  return merged;
}
