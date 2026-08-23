// 일정의 "다중일" / "반복" 규칙을 한 곳에서 계산하는 헬퍼.
//
// 데이터 모델 요약 (Firestore `events` 컬렉션):
// - start: 일정의 최초(또는 유일한) 날짜+시작시간
// - end: 같은 날의 종료시간 (다중일이어도 end의 "시간"만 사용, 날짜는 endDate를 봄)
// - endDate: 다중일 일정일 때만 존재. 마지막 날짜(그 날의 종료시간은 end의 시간을 사용)
// - recurrenceType: 'none' | 'weekly' | 'monthly' | 'yearly'
//   (레거시 문서는 recurrenceType이 없고 recurring: true 만 있을 수 있음 -> 'yearly'로 취급)
//
// 단순화를 위해 "다중일"과 "반복"은 동시에 쓰지 않는다 (반복 일정은 항상 하루짜리).

export type EventLike = {
  start: Date;
  end: Date;
  endDate?: Date | null;
  recurrenceType?: 'none' | 'weekly' | 'monthly' | 'yearly';
  recurring?: boolean; // 레거시 필드
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getRecurrenceType(event: EventLike): 'none' | 'weekly' | 'monthly' | 'yearly' {
  if (event.recurrenceType) return event.recurrenceType;
  if (event.recurring) return 'yearly'; // 레거시 문서 호환
  return 'none';
}

/** 특정 날짜(day)에 이 일정이 표시되어야 하는지 여부 */
export function eventOccursOnDay(event: EventLike, day: Date): boolean {
  const recurrenceType = getRecurrenceType(event);
  const dayStart = startOfDay(day);
  const eventStart = startOfDay(event.start);

  if (recurrenceType === 'none') {
    const rangeEnd = event.endDate ? startOfDay(event.endDate) : eventStart;
    return dayStart.getTime() >= eventStart.getTime() && dayStart.getTime() <= rangeEnd.getTime();
  }

  if (dayStart.getTime() < eventStart.getTime()) return false;

  if (recurrenceType === 'yearly') {
    return dayStart.getMonth() === eventStart.getMonth() && dayStart.getDate() === eventStart.getDate();
  }

  if (recurrenceType === 'monthly') {
    const dim = daysInMonth(dayStart.getFullYear(), dayStart.getMonth());
    const targetDay = Math.min(eventStart.getDate(), dim);
    return dayStart.getDate() === targetDay;
  }

  if (recurrenceType === 'weekly') {
    return dayStart.getDay() === eventStart.getDay();
  }

  return false;
}

/** 화면에 보이는 날짜 배열(days) 중 이 일정이 실제로 걸쳐있는 날짜들만 반환 */
export function getEventDaysInRange(event: EventLike, days: Date[]): Date[] {
  return days.filter((d) => eventOccursOnDay(event, d));
}

/**
 * 주어진 기간(rangeStart~rangeEnd, 포함) 안에서 이 일정이 발생하는 "실제 날짜" 목록을 반환.
 * 홈 화면의 시간순 통합 목록에서 반복 일정을 개별 항목으로 펼쳐 보여줄 때 사용.
 * 무한 반복을 막기 위해 최대 366일까지만 훑는다.
 */
export function expandOccurrences(event: EventLike, rangeStart: Date, rangeEnd: Date): Date[] {
  const result: Date[] = [];
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const maxDays = 366;
  let cursor = new Date(start);
  let count = 0;
  while (cursor.getTime() <= end.getTime() && count < maxDays) {
    if (eventOccursOnDay(event, cursor)) result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    count++;
  }
  return result;
}

export const RECURRENCE_LABELS: Record<string, string> = {
  none: '반복 안 함',
  weekly: '매주 반복',
  monthly: '매월 반복',
  yearly: '매년 반복',
};
