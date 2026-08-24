'use client';

import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Repeat, CalendarRange } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType, getOccurrenceTimes } from '../../lib/recurrence';

const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function colorClasses(event: any) {
  const isRecurring = getRecurrenceType(event) !== 'none';
  if (isRecurring) return 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/25 dark:border-violet-400 dark:text-violet-100';
  switch (event.color) {
    case 'green': return 'bg-emerald-50 border-emerald-600 text-emerald-900 dark:bg-emerald-500/25 dark:border-emerald-500 dark:text-emerald-100';
    case 'rose': return 'bg-rose-50 border-rose-600 text-rose-900 dark:bg-rose-500/25 dark:border-rose-500 dark:text-rose-100';
    case 'amber': return 'bg-amber-50 border-amber-600 text-amber-900 dark:bg-amber-500/25 dark:border-amber-500 dark:text-amber-100';
    case 'violet': return 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/25 dark:border-violet-500 dark:text-violet-100';
    default: return 'bg-blue-50 border-blue-600 text-blue-900 dark:bg-blue-500/25 dark:border-blue-500 dark:text-blue-100';
  }
}

/**
 * 하루 단위 시간표(00시~23시)를 여러 날짜(days)에 대해 나란히 렌더링.
 * days.length === 1 이면 일별보기, 7이면 주별보기로 쓰인다.
 */
export default function TimeGrid({ days, events, holidayMap, onSlotClick, onEventClick }: any) {
  // 종일(다중일) 일정: 시간표 상단에 별도로 표시
  const allDayEvents = (events || []).filter((e: any) => !!e.endDate);
  // 시간대 배치 대상: 단일일 일정(반복 포함)
  const timedEvents = (events || []).filter((e: any) => !e.endDate);

  return (
    <div className="flex flex-col border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xl bg-white/70 dark:bg-slate-900/20">
      {/* 헤더: 날짜 */}
      <div className="flex border-b border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
        <div className="w-12 shrink-0" />
        {days.map((day: Date, i: number) => {
          const isToday = isSameDay(day, new Date());
          const dow = day.getDay();
          const holidayName = holidayMap?.[format(day, 'yyyy-MM-dd')];
          const dateColorClass = isToday ? 'text-blue-600 dark:text-blue-400' : holidayName || dow === 0 ? 'text-rose-500 dark:text-rose-400' : dow === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300';
          return (
            <div key={i} className="flex-1 min-w-0 text-center py-2 border-l border-slate-200 dark:border-slate-800 first:border-l-0">
              <div className="text-[10px] text-slate-400">{format(day, 'EEE', { locale: ko })}</div>
              <div className={`text-sm font-black ${dateColorClass}`}>{format(day, 'd')}</div>
              {holidayName && <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate px-1">{holidayName}</div>}
            </div>
          );
        })}
      </div>

      {/* 종일 일정 */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <div className="w-12 shrink-0 text-[9px] text-slate-400 flex items-center justify-center">종일</div>
          {days.map((day: Date, i: number) => (
            <div key={i} className="flex-1 min-w-0 border-l border-slate-100 dark:border-slate-800/60 first:border-l-0 p-1 space-y-1">
              {allDayEvents.filter((e: any) => eventOccursOnDay(e, day)).map((e: any, idx: number) => (
                <div key={idx} onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }} className={`px-1.5 py-1 rounded text-[10px] font-bold truncate border-l-4 flex items-center gap-1 cursor-pointer ${colorClasses(e)}`}>
                  <CalendarRange className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{e.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 시간표 본문 */}
      <div className="flex overflow-y-auto max-h-[65vh]">
        <div className="w-12 shrink-0">
          {HOURS.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="text-[9px] text-slate-400 text-right pr-1.5 -translate-y-1.5 border-t border-slate-100 dark:border-slate-800/60">{h === 0 ? '' : `${String(h).padStart(2, '0')}시`}</div>
          ))}
        </div>
        {days.map((day: Date, i: number) => {
          const dayEvents = timedEvents.filter((e: any) => eventOccursOnDay(e, day));
          return (
            <div key={i} className="flex-1 min-w-0 relative border-l border-slate-100 dark:border-slate-800/60 first:border-l-0">
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick?.(day, h)}
                  className="border-t border-slate-100 dark:border-slate-800/60 hover:bg-blue-500/5 cursor-pointer"
                />
              ))}
              {dayEvents.map((e: any, idx: number) => {
                const { start, end } = getOccurrenceTimes(e, day);
                const top = (start.getHours() * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
                const durationMin = Math.max((end.getTime() - start.getTime()) / 60000, 20);
                const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 18);
                const overlapping = dayEvents.length;
                const width = overlapping > 1 ? `${100 / overlapping}%` : '100%';
                const left = overlapping > 1 ? `${(100 / overlapping) * idx}%` : '0';
                return (
                  <div
                    key={idx}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }}
                    style={{ position: 'absolute', top, height, width, left }}
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold truncate border-l-4 cursor-pointer overflow-hidden flex items-center gap-1 ${colorClasses(e)}`}
                  >
                    {getRecurrenceType(e) !== 'none' && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                    <span className="truncate">{e.title}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
