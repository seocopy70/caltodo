'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Repeat, CalendarRange, MapPin, AlignLeft } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType, getOccurrenceTimes } from '../../lib/recurrence';

const HOUR_HEIGHT = 38; // px per hour (기존 42 대비 살짝 축소 — 그리드 전체 높이를 조금 줄임)
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCROLL_TO_HOUR = 6; // 탭 진입 시 06시 위치로 스크롤 (위아래로 스크롤하면 00~24시 전체 확인 가능)
const WEEK_VISIBLE_HOURS_FALLBACK = 13; // availableHeight를 아직 측정 못했을 때(첫 렌더)만 쓰는 기본값

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
export default function TimeGrid({ days, events, holidayMap, onSlotClick, onEventClick, onDayHeaderClick, availableHeight }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);
  const [topSectionHeight, setTopSectionHeight] = useState(0);
  const HOURS: number[] = ALL_HOURS;
  const isWeekView = days.length > 1;
  // 주별보기도 일별보기와 동일하게 최소 폭을 두지 않고 화면 너비에 맞춰 7칸이 균등하게 눌려 들어가게 함
  // (좁은 화면에서 가로 스크롤 없이 한 화면에 다 보이도록).
  const colStyle: CSSProperties = {};
  const innerMinWidth: number | undefined = undefined;

  // 구글/삼성 캘린더의 "현재 시각" 빨간 줄. 1분마다 다시 계산해서 살아있게 유지.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
  const todayInView = days.some((d: Date) => isSameDay(d, now));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 종일(다중일 또는 00:00~23:59 컨벤션) 일정: 시간표 상단에 별도로 표시
  const allDayEvents = (events || []).filter((e: any) => !!e.endDate || isAllDayConvention(e.start, e.end));
  // 시간대 배치 대상: 단일일 일정(반복 포함), 종일 컨벤션 제외
  const timedEvents = (events || []).filter((e: any) => !e.endDate && !isAllDayConvention(e.start, e.end));

  // 주별보기 시간표 본문 높이: 요일헤더+종일영역을 뺀 "화면에 실제로 남는 만큼"을 계산해서
  // 그 안에서 경계가 보이고, 넘치는 시간대는 내부 스크롤로 확인하게 함.
  useEffect(() => {
    if (!isWeekView) return;
    const el = topSectionRef.current;
    if (el) setTopSectionHeight(el.getBoundingClientRect().height);
  }, [isWeekView, allDayEvents.length, availableHeight]);
  const MIN_BODY_HEIGHT = 180;
  const weekBodyMaxHeight = isWeekView
    ? (availableHeight != null && topSectionHeight > 0
        ? Math.max(availableHeight - topSectionHeight - 4, MIN_BODY_HEIGHT)
        : WEEK_VISIBLE_HOURS_FALLBACK * HOUR_HEIGHT)
    : '65vh';

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white/70 dark:bg-slate-900/20">
      {/* data-hscroll: 이 영역 안에서 좌우로 밀면 그리드 자체가 스크롤되고(탭 순환 아님), 영역 밖에서 밀면 탭이 순환됨.
          주의: 이 컨테이너 안에는 세로 스크롤이 필요한 시간표 본문(scrollRef, touch-pan-y)이 중첩되어 있음.
          바깥 컨테이너를 touch-pan-x만으로 제한하면 touch-action 교집합이 비어버려서(pan-x ∩ pan-y = none)
          본문 영역 대부분에서 세로 스크롤이 먹통이 되는 문제가 있었음(맨 위 경계 부근에서만 간헐적으로 동작).
          바깥은 x/y 모두 허용해 두고, 실제 축 구분은 안쪽(scrollRef=touch-pan-y, 헤더/종일 영역=상속된 양축)에서 맡김 */}
      <div data-hscroll className="overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y">
        <div style={innerMinWidth ? { minWidth: innerMinWidth } : undefined}>
          <div ref={topSectionRef}>
          {/* 헤더: 구글 캘린더 스타일로 요일(작게)을 위에, 날짜(크게, 오늘은 원형 배지)를 아래에 */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            <div className="w-9 shrink-0" />
            {days.map((day: Date, i: number) => {
              const isToday = isSameDay(day, new Date());
              const dow = day.getDay();
              const holidayName = holidayMap?.[format(day, 'yyyy-MM-dd')];
              const weekdayColorClass = holidayName || dow === 0 ? 'text-rose-500 dark:text-rose-400' : dow === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500';
              return (
                <div
                  key={i}
                  style={colStyle}
                  onClick={isWeekView ? () => onDayHeaderClick?.(day) : undefined}
                  className={`flex-1 min-w-0 text-center py-1.5 border-l border-slate-100 dark:border-slate-800/60 first:border-l-0 ${isWeekView ? 'cursor-pointer hover:bg-blue-500/5' : ''}`}
                >
                  <div className={`text-[10px] font-bold ${weekdayColorClass}`}>{format(day, 'EEE', { locale: ko })}</div>
                  <div className={`mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${isToday ? 'bg-blue-600 text-white' : weekdayColorClass}`}>{format(day, 'd')}</div>
                  {holidayName && <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate px-1 mt-0.5">{holidayName}</div>}
                </div>
              );
            })}
          </div>

          {/* 종일 일정: 기본 높이를 시간 그리드 한 칸과 동일하게 맞춤 */}
          {allDayEvents.length > 0 && (
            <div className="flex border-b border-slate-100 dark:border-slate-800/60">
              <div style={{ minHeight: HOUR_HEIGHT }} className="w-9 shrink-0 text-[9px] text-slate-400 flex items-center justify-center">종일</div>
              {days.map((day: Date, i: number) => (
                <div key={i} style={{ minHeight: HOUR_HEIGHT, ...colStyle }} className="flex-1 min-w-0 border-l border-slate-50 dark:border-slate-800/40 first:border-l-0 p-1 space-y-1">
                  {allDayEvents.filter((e: any) => eventOccursOnDay(e, day)).map((e: any, idx: number) => (
                    <div key={idx} onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }} className={`px-1.5 py-0.5 rounded-full text-sm font-bold truncate flex items-center gap-1 cursor-pointer ${colorClasses(e)}`}>
                      <CalendarRange className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{e.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          </div>

          {/* 시간표 본문: 주별보기는 화면에 실제로 남는 높이에 맞춰 경계를 두고(내부는 스크롤로 00~24시 전체 확인 가능),
              일별보기는 화면 비율 기준. touch-pan-x도 함께 허용해서, 이 영역 안에서 시작한 좌우 스와이프가
              바깥(data-hscroll)의 가로 스크롤로 정상적으로 이어지게 함 — pan-y만 허용했을 때는 먹통이었음. */}
          <div ref={scrollRef} className="flex overflow-y-auto touch-pan-x touch-pan-y" style={{ maxHeight: weekBodyMaxHeight }}>
            <div className="w-9 shrink-0">
              {HOURS.map((h) => (
                <div key={h} style={{ height: HOUR_HEIGHT }} className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-right pr-1 -translate-y-1.5 border-t border-slate-50 dark:border-slate-800/40">{h === 0 ? '' : `${h}시`}</div>
              ))}
            </div>
            {days.map((day: Date, i: number) => {
              const dayItems = timedEvents
                .filter((e: any) => eventOccursOnDay(e, day))
                .map((e: any) => ({ event: e, ...getOccurrenceTimes(e, day) }));
              const layout = layoutColumns(dayItems);
              const isTodayCol = isSameDay(day, now);
              return (
                <div key={i} style={colStyle} className={`flex-1 min-w-0 relative border-l border-slate-50 dark:border-slate-800/40 first:border-l-0 ${isTodayCol ? 'bg-blue-500/5' : ''}`}>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => onSlotClick?.(day, h)}
                      className="border-t border-slate-50 dark:border-slate-800/40 hover:bg-blue-500/5 cursor-pointer"
                    />
                  ))}
                  {/* 구글 캘린더의 상징적인 "현재 시각" 표시줄 — 오늘 컬럼에만 표시 */}
                  {isTodayCol && (
                    <div style={{ top: nowTop }} className="absolute left-0 right-0 z-10 pointer-events-none flex items-center">
                      <span className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
                      <span className="flex-1 h-[1.5px] bg-rose-500" />
                    </div>
                  )}
                  {dayItems.map((item: any, idx: number) => {
                    const { event: e, start, end } = item;
                    const top = (start.getHours() * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
                    const durationMin = Math.max((end.getTime() - start.getTime()) / 60000, 20);
                    // 배경색 박스 높이를 폰트보다 살짝만 크게 축소
                    const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 15);
                    const pos = layout.get(e) || { widthPct: 100, leftPct: 0 };
                    const extraInfo = e.location || e.description || '';
                    const ExtraIcon = e.location ? MapPin : AlignLeft; // 장소면 MapPin, 메모(설명)면 AlignLeft — 오늘탭과 동일한 아이콘 규칙
                    // 일별보기: 옆으로(같은 줄), 주별보기: 박스가 기본 그리드 높이보다 클 때만 아래쪽에
                    const showBeside = !isWeekView && pos.widthPct >= 45 && !!extraInfo;
                    const showBelow = isWeekView && height > HOUR_HEIGHT && pos.widthPct >= 45 && !!extraInfo;
                    return (
                      <div
                        key={idx}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }}
                        style={{ position: 'absolute', top, height, width: `calc(${pos.widthPct}% - 2px)`, left: `${pos.leftPct}%` }}
                        className={`px-1.5 py-0.5 rounded-lg text-sm font-bold cursor-pointer overflow-hidden flex flex-col justify-center border-l-4 ${colorClasses(e)}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {getRecurrenceType(e) !== 'none' && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                          <span className="truncate">{e.title}</span>
                          {showBeside && <span className="flex items-center gap-0.5 text-sm font-medium opacity-70 truncate shrink-0"><ExtraIcon className="w-3 h-3 shrink-0" />{extraInfo}</span>}
                        </div>
                        {showBelow && <div className="flex items-center gap-1 text-xs font-medium opacity-70 truncate"><ExtraIcon className="w-3 h-3 shrink-0" />{extraInfo}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
