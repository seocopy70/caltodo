'use client';

import { useEffect, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Repeat, CalendarRange } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType, getOccurrenceTimes } from '../../lib/recurrence';

const HOUR_HEIGHT = 42; // px per hour (기존 48 대비 살짝 축소)
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCROLL_TO_HOUR = 6; // 탭 진입 시 06시 위치로 스크롤 (위아래로 스크롤하면 00~24시 전체 확인 가능)
const WEEK_VISIBLE_HOURS = 15; // 주별보기에서 스크롤 없이 기본으로 보여줄 시간 범위(06~20시)

function isAllDayConvention(start: Date, end: Date) {
  return start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59;
}

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

// 실제로 시간이 겹치는 일정끼리만 클러스터로 묶어 폭을 나눔 (안 겹치면 전체 폭 사용)
function layoutColumns(items: { event: any; start: Date; end: Date }[]) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime());
  const clusters: typeof sorted[] = [];
  let current: typeof sorted = [];
  let clusterEnd = -Infinity;
  for (const item of sorted) {
    if (current.length === 0 || item.start.getTime() < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end.getTime());
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end.getTime();
    }
  }
  if (current.length > 0) clusters.push(current);

  const layout = new Map<any, { widthPct: number; leftPct: number }>();
  for (const cluster of clusters) {
    const n = cluster.length;
    cluster.forEach((item, idx) => {
      layout.set(item.event, { widthPct: 100 / n, leftPct: (100 / n) * idx });
    });
  }
  return layout;
}

/**
 * 하루 단위 시간표(00시~23시)를 여러 날짜(days)에 대해 나란히 렌더링.
 * days.length === 1 이면 일별보기, 7이면 주별보기로 쓰인다.
 */
export default function TimeGrid({ days, events, holidayMap, onSlotClick, onEventClick, onDayHeaderClick }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const HOURS: number[] = ALL_HOURS;
  const firstHour = 0;
  const isWeekView = days.length > 1;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 종일(다중일 또는 00:00~23:59 컨벤션) 일정: 시간표 상단에 별도로 표시
  const allDayEvents = (events || []).filter((e: any) => !!e.endDate || isAllDayConvention(e.start, e.end));
  // 시간대 배치 대상: 단일일 일정(반복 포함), 종일 컨벤션 제외
  const timedEvents = (events || []).filter((e: any) => !e.endDate && !isAllDayConvention(e.start, e.end));

  return (
    <div className="flex flex-col border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xl bg-white/70 dark:bg-slate-900/20">
      {/* 헤더: 요일+날짜 한 줄 */}
      <div className="flex border-b border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
        <div className="w-9 shrink-0" />
        {days.map((day: Date, i: number) => {
          const isToday = isSameDay(day, new Date());
          const dow = day.getDay();
          const holidayName = holidayMap?.[format(day, 'yyyy-MM-dd')];
          const dateColorClass = isToday ? 'text-blue-600 dark:text-blue-400' : holidayName || dow === 0 ? 'text-rose-500 dark:text-rose-400' : dow === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300';
          return (
            <div
              key={i}
              onClick={isWeekView ? () => onDayHeaderClick?.(day) : undefined}
              className={`flex-1 min-w-0 text-center py-2 border-l border-slate-200 dark:border-slate-800 first:border-l-0 ${isWeekView ? 'cursor-pointer hover:bg-blue-500/5' : ''}`}
            >
              <div className={`text-sm font-black flex items-center justify-center gap-1 ${dateColorClass}`}><span>{format(day, 'd')}</span><span className="text-[10px] font-bold text-slate-400">({format(day, 'EEE', { locale: ko })})</span></div>
              {holidayName && <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate px-1">{holidayName}</div>}
            </div>
          );
        })}
      </div>

      {/* 종일 일정 */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 shrink-0 text-[9px] text-slate-400 flex items-center justify-center">종일</div>
          {days.map((day: Date, i: number) => (
            <div key={i} className="flex-1 min-w-0 border-l border-slate-100 dark:border-slate-800/60 first:border-l-0 p-1 space-y-1">
              {allDayEvents.filter((e: any) => eventOccursOnDay(e, day)).map((e: any, idx: number) => (
                <div key={idx} onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }} className={`px-1.5 py-0.5 rounded text-xs font-bold truncate border-l-4 flex items-center gap-1 cursor-pointer ${colorClasses(e)}`}>
                  <CalendarRange className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{e.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 시간표 본문: 주별보기는 기본으로 06~20시 정도만 보이는 높이로 제한하고(스크롤 시 00~24시 전체 확인 가능), 일별보기는 화면 비율 기준 */}
      <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: isWeekView ? WEEK_VISIBLE_HOURS * HOUR_HEIGHT : '65vh' }}>
        <div className="w-9 shrink-0">
          {HOURS.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-right pr-1 -translate-y-1.5 border-t border-slate-100 dark:border-slate-800/60">{h === 0 ? '' : `${h}시`}</div>
          ))}
        </div>
        {days.map((day: Date, i: number) => {
          const dayItems = timedEvents
            .filter((e: any) => eventOccursOnDay(e, day))
            .map((e: any) => ({ event: e, ...getOccurrenceTimes(e, day) }));
          const layout = layoutColumns(dayItems);
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
              {dayItems.map((item: any, idx: number) => {
                const { event: e, start, end } = item;
                const top = ((start.getHours() * 60 + start.getMinutes()) / 60 - firstHour) * HOUR_HEIGHT;
                const durationMin = Math.max((end.getTime() - start.getTime()) / 60000, 20);
                // 배경색 박스 높이를 폰트보다 살짝만 크게 축소
                const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 15);
                const pos = layout.get(e) || { widthPct: 100, leftPct: 0 };
                // 박스가 충분히 넓고/높을 때만 장소·메모 등 추가정보를 제목 옆에 보여줌
                const hasRoom = pos.widthPct >= 45 && height >= 26;
                return (
                  <div
                    key={idx}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }}
                    style={{ position: 'absolute', top, height, width: `calc(${pos.widthPct}% - 2px)`, left: `${pos.leftPct}%` }}
                    className={`px-1.5 py-0.5 rounded-md text-xs font-bold truncate border-l-4 cursor-pointer overflow-hidden flex items-center gap-1.5 ${colorClasses(e)}`}
                  >
                    {getRecurrenceType(e) !== 'none' && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                    <span className="truncate">{e.title}</span>
                    {hasRoom && e.location && <span className="text-[11px] font-medium opacity-70 truncate">· {e.location}</span>}
                    {hasRoom && !e.location && e.description && <span className="text-[11px] font-medium opacity-70 truncate">· {e.description}</span>}
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
