import KoreanLunarCalendar from 'korean-lunar-calendar';

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function lunarToSolarDate(year: number, month: number, day: number): Date {
  const cal = new KoreanLunarCalendar();
  cal.setLunarDate(year, month, day, false);
  const s = cal.getSolarCalendar();
  return new Date(s.year, s.month - 1, s.day);
}

function addDaysDate(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// 대체공휴일 적용 대상 (2025년 기준 법령: 설/추석/삼일절/광복절/개천절/한글날/어린이날)
const SUBSTITUTE_TARGETS = new Set([
  '설날 연휴', '설날', '추석 연휴', '추석',
  '삼일절', '광복절', '개천절', '한글날', '어린이날',
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

  // 대체공휴일: 대상 공휴일이 토/일요일과 겹치면 다음 평일로 이동
  const targets = Object.entries(map).filter(([, name]) => SUBSTITUTE_TARGETS.has(name));
  for (const [key] of targets) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) {
      let next = addDaysDate(date, 1);
      while (
        map[toKey(next.getFullYear(), next.getMonth() + 1, next.getDate())] ||
        next.getDay() === 0 ||
        next.getDay() === 6
      ) {
        next = addDaysDate(next, 1);
      }
      map[toKey(next.getFullYear(), next.getMonth() + 1, next.getDate())] = '대체공휴일';
    }
  }

  return map;
}

/** 여러 연도의 공휴일 맵을 한 번에 합쳐서 반환 (월 그리드가 연도 경계를 넘을 때 사용) */
export function getKoreanHolidaysForYears(years: number[]): Record<string, string> {
  const merged: Record<string, string> = {};
  Array.from(new Set(years)).forEach((y) => Object.assign(merged, getKoreanHolidays(y)));
  return merged;
}
