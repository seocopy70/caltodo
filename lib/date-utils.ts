export const MONTHS_KO = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const WEEKDAYS_FULL_KO = [
  '일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일',
];

export function formatTimeKo(t: string) {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? '오후' : '오전';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${ampm} ${display}:${m}`;
}

export function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateKeyOrNull(date: Date | null) {
  if (!date) return '';
  return formatDateKey(date);
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
