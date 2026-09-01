'use client';

import { useEffect, useRef, useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, addDays, subDays
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Grid3x3, Rows3, Maximize2, Minimize2 } from 'lucide-react';
import { getKoreanHolidaysForYears } from '../../lib/holidays';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import EventModal from '../calendar/EventModal';
import DayViewModal from '../calendar/DayViewModal';
import TimeGrid from '../calendar/TimeGrid';

function getLunarLabel(date: Date) {
  const cal = new KoreanLunarCalendar();
  cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = cal.getLunarCalendar();
  return `${lunar.intercalation ? '윤' : ''}${lunar.month}.${lunar.day}`;
}

// 월별보기 칸이 아주 좁을 때(dots 모드) 쓰는 색깔 점 — 위 이벤트 칩과 동일한 색상 규칙
function eventDotColor(event: any) {
  const isRecurring = getRecurrenceType(event) !== 'none';
  if (isRecurring) return 'bg-violet-500';
  switch (event.color) {
    case 'green': return 'bg-emerald-500';
    case 'rose': return 'bg-rose-500';
    case 'amber': return 'bg-amber-500';
    case 'violet': return 'bg-violet-500';
    default: return 'bg-blue-500';
  }
}

const YEAR_RANGE = 15;
const MONTH_CELL_MIN_HEIGHT = 40; // 화면이 아주 좁아도 위아래 경계 안에 다 들어오도록 기존(62)보다 더 낮춤(그 아래는 점(dot) 모드로 표시)
const MONTH_CELL_FALLBACK_HEIGHT = 110; // 화면 높이를 아직 측정하기 전(첫 렌더)에 쓰는 기본값

// 탭 상단부터 화면 맨 아래까지 남은 높이를 실측해서 반환하는 공용 훅(월별보기 그리드/주별보기 시간표에서 함께 사용).
// 다른 탭에서 스크롤이 남아있는 채로 넘어오는 경우를 대비해 top이 음수면 0으로 고정하고,
// 폰트 교체·주소창 접힘 등 뒤늦은 레이아웃 변화에 대비해 한 번 더 재측정한다.
function useFitAvailableHeight(active: boolean, ref: React.RefObject<HTMLElement | null>, extraDep: number) {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const recompute = () => {
      const el = ref.current;
      if (!el) return;
      const top = Math.max(el.getBoundingClientRect().top, 0);
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      setHeight(Math.max(viewportHeight - top - 12, 0));
    };
    recompute();
    const lateTimer = setTimeout(recompute, 300);
    window.addEventListener('resize', recompute);
    window.visualViewport?.addEventListener('resize', recompute);
    return () => {
      clearTimeout(lateTimer);
      window.removeEventListener('resize', recompute);
      window.visualViewport?.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, extraDep]);
  return height;
}

export default function Calendar({ initialView = 'month', events, user, onNotify, onRefresh }: any) {
  const [view, setCalView] = useState<'month' | 'week'>(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const monthGridWrapperRef = useRef<HTMLDivElement>(null);
  const weekGridWrapperRef = useRef<HTMLDivElement>(null);
  // 폰 좁은 화면에서 "넓게보기"를 켜면 폰 넓은화면 기본 폭으로 일정표를 보여주고 그 안에서만 좌우로 스크롤함
  const [wideView, setWideView] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({ start: view === 'month' ? startOfWeek(monthStart) : weekStart, end: view === 'month' ? endOfWeek(endOfMonth(monthStart)) : endOfWeek(currentDate) });
  const numWeeks = days.length / 7;

  // 구글/삼성 캘린더처럼 월별보기를 스크롤 없이 화면 안에 다 들어오게: 그리드가 시작하는 위치부터
  // 화면 맨 아래까지 남은 높이를 실측해서, 그 안에 주 수(numWeeks)만큼 칸을 나눠 담는다.
  const monthAvailableHeight = useFitAvailableHeight(view === 'month', monthGridWrapperRef, numWeeks);
  // 주별보기 시간표도 동일한 방식으로 화면 안에 경계가 보이도록 남은 높이를 실측(내부는 스크롤).
  const weekAvailableHeight = useFitAvailableHeight(view === 'week', weekGridWrapperRef, 0);

  const monthCellHeight = Math.max(
    monthAvailableHeight != null ? Math.floor(monthAvailableHeight / numWeeks) : MONTH_CELL_FALLBACK_HEIGHT,
    MONTH_CELL_MIN_HEIGHT
  );
  // 칸 크기에 따라 일정을 얼마나 보여줄지 단계적으로 조절: 넉넉하면 제목 텍스트 2줄, 좁으면 1줄,
  // 아주 좁으면 제목 없이 색깔 점(dot)만 — 화면 안에 다 들어오게 하면서도 정보는 최대한 보여줌
  const monthEventMode: 'chips2' | 'chips1' | 'dots' = monthCellHeight >= 100 ? 'chips2' : monthCellHeight >= 70 ? 'chips1' : 'dots';
  const monthCellMaxChips = monthEventMode === 'chips2' ? 2 : monthEventMode === 'chips1' ? 1 : 0;
  const showLunarLabel = monthCellHeight >= 78;
  const weekOfMonth = Math.ceil((currentDate.getDate() + startOfMonth(currentDate).getDay()) / 7);
  const yearFrom = currentDate.getFullYear() - YEAR_RANGE;
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => yearFrom + i);
  const holidayMap = getKoreanHolidaysForYears(days.map((d) => d.getFullYear()));

  const closeModal = () => { setIsModalOpen(false); setEditingEvent(null); };
  const openNewEvent = (day: Date) => { setSelectedDate(day); setEditingEvent(null); setIsModalOpen(true); };
  const openEditEvent = (event: any) => { setEditingEvent(event); setSelectedDate(event.start); setIsModalOpen(true); };
  const jumpTo = (year: number, month: number) => { setCurrentDate(new Date(year, month, 1)); setIsDatePickerOpen(false); };

  const handleDayClick = (day: Date) => {
    // 일정 유무와 상관없이 날짜를 탭하면 항상 일별보기를 띄움(일정 없는 날에도 그 안에서 새 일정 추가 가능)
    setDayViewDate(day);
  };

  const handleSlotClick = (day: Date, hour: number) => {
    openNewEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-3 flex-wrap gap-y-2">
        <button onClick={() => setIsDatePickerOpen((v) => !v)} className="group flex items-center gap-1.5 text-left rounded-xl px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-w-0 shrink-0" title="연월 선택">
          <h2 className="text-lg sm:text-2xl font-bold whitespace-nowrap">
            {view === 'month' ? (
              <>
                <span className="hidden sm:inline">{format(currentDate, 'yyyy년 MMMM', { locale: ko })}</span>
                <span className="sm:hidden">{format(currentDate, 'M월', { locale: ko })}</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">{format(currentDate, 'M', { locale: ko })}월 {weekOfMonth}주차</span>
                <span className="sm:hidden">{weekOfMonth}주차</span>
              </>
            )}
          </h2>
          <CalendarDays className="w-5 h-5 text-slate-400 group-hover:text-blue-500 shrink-0" />
        </button>

        {/* 월/주 이동 + 오늘 버튼: 줄 가운데 */}
        <div className="flex-1 flex justify-center">
          <div className="flex gap-1.5 sm:gap-2"><button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronLeft/></button><button onClick={() => setCurrentDate(new Date())} className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 whitespace-nowrap">오늘</button><button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronRight/></button></div>
        </div>

        {/* 토글 버튼들: 줄 오른쪽 끝(월/주 토글 -> 넓게/맞춤 토글 순서) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 월별/주별보기 전환: 메모탭 보기옵션처럼 한 칸짜리 아이콘 토글(탭하면 전환될 모드의 아이콘을 보여줌) */}
          <button
            type="button"
            onClick={() => setCalView((v) => (v === 'month' ? 'week' : 'month'))}
            title={view === 'month' ? '탭하면 주별보기로' : '탭하면 월별보기로'}
            className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0"
          >
            {view === 'month' ? <Rows3 className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
          </button>
          {/* 넓게보기/맞춤보기 전환: 폰 좁은 화면에서만 의미가 있어서 그 화면에서만 보여줌 */}
          <button
            type="button"
            onClick={() => setWideView((v) => !v)}
            title={wideView ? '탭하면 화면에 맞춰 보기' : '탭하면 넓게 보기'}
            className="sm:hidden py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0"
          >
            {wideView ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isDatePickerOpen && <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4"><div className="flex items-center justify-between mb-3"><div className="text-sm font-bold text-slate-700 dark:text-slate-200">연월로 바로 이동</div><button onClick={() => setIsDatePickerOpen(false)} className="text-xs text-slate-500">닫기</button></div><div className="flex gap-3 mb-3"><select value={currentDate.getFullYear()} onChange={(e) => jumpTo(Number(e.target.value), currentDate.getMonth())} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold outline-none">{years.map((year) => <option key={year} value={year}>{year}년</option>)}</select><div className="flex-[2] grid grid-cols-6 gap-1.5">{Array.from({ length: 12 }, (_, month) => <button key={month} onClick={() => jumpTo(currentDate.getFullYear(), month)} className={`rounded-lg px-2 py-2 text-xs font-bold ${month === currentDate.getMonth() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{month + 1}월</button>)}</div></div></div>}

      {view === 'week' ? (
        <div ref={weekGridWrapperRef}>
          <TimeGrid days={days} events={events} holidayMap={holidayMap} onSlotClick={handleSlotClick} onEventClick={openEditEvent} onDayHeaderClick={(day: Date) => setDayViewDate(day)} availableHeight={weekAvailableHeight} wideView={wideView} />
        </div>
      ) : (
        <div className={wideView ? 'overflow-x-auto -mx-2.5 px-2.5' : ''} data-no-tab-cycle={wideView || undefined}>
        {/* touch-pan-x만 걸려있으면(이전 방식) 이 영역 안에서 시작한 세로 스와이프가 페이지 스크롤로
            이어지지 못해 "월별보기에서 위아래 스크롤이 안 되는" 문제가 있었음 — x/y 모두 허용. */}
        <div ref={monthGridWrapperRef} className={`rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/70 dark:bg-slate-900/20 overflow-hidden ${wideView ? 'min-w-[640px]' : ''}`}>
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800/60 py-1.5">{['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={i === 0 ? 'text-rose-500 dark:text-rose-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : ''}>{d}</div>)}</div>
            {Array.from({ length: numWeeks }, (_, weekIdx) => {
              const week = days.slice(weekIdx * 7, weekIdx * 7 + 7);
              return (
                // 모든 주(週)가 동일한 높이를 쓰도록 화면에 맞춰 계산된 높이로 고정.
                // 넘치는 일정은 늘어나지 않고 "+N개 더" 표시(또는 좁을 땐 점)로 요약해서, 화면 밖으로 넘치지 않게 함.
                <div key={weekIdx} className="grid border-b border-slate-100 dark:border-slate-800/60 last:border-b-0" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {week.map((day, i) => {
                    const dayEvents = events.filter((e: any) => eventOccursOnDay(e, day));
                    const visibleEvents = dayEvents.slice(0, monthCellMaxChips);
                    const hiddenCount = dayEvents.length - visibleEvents.length;
                    const isToday = isSameDay(day, new Date());
                    const dow = day.getDay();
                    const holidayName = holidayMap[format(day, 'yyyy-MM-dd')];
                    const lunarLabel = showLunarLabel ? getLunarLabel(day) : null;
                    const dateColorClass = isToday ? '' : holidayName || dow === 0 ? 'text-rose-500 dark:text-rose-400' : dow === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400';
                    return <div key={i} onClick={() => openNewEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0))} style={{ height: monthCellHeight }} className={`p-1.5 border-r border-slate-100 dark:border-slate-800/60 last:border-r-0 transition-all cursor-pointer hover:bg-blue-500/5 overflow-hidden ${!isSameMonth(day, monthStart) ? 'opacity-40 dark:opacity-10' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <div onClick={(e) => { e.stopPropagation(); handleDayClick(day); }} className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : dateColorClass}`}>{format(day, 'd')}</div>
                        {lunarLabel && <div className="text-[9px] text-slate-400 dark:text-slate-600 leading-tight">{lunarLabel}</div>}
                      </div>
                      {holidayName && <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate leading-tight text-center mb-1">{holidayName}</div>}
                      {monthEventMode === 'dots' ? (
                        // 칸이 아주 좁을 때: 제목 텍스트 대신 색깔 점으로만 몇 개 있는지 보여줌(구글/삼성 캘린더 방식)
                        dayEvents.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                            {dayEvents.slice(0, 6).map((event: any, idx: number) => (
                              <span key={idx} onClick={(e) => { e.stopPropagation(); openEditEvent(event); }} className={`w-1.5 h-1.5 rounded-full ${eventDotColor(event)}`} />
                            ))}
                            {dayEvents.length > 6 && <span className="text-[9px] font-bold text-slate-400 leading-none">+{dayEvents.length - 6}</span>}
                          </div>
                        )
                      ) : (
                        <>
                          {/* 월별보기에서는 칸이 좁아 추가정보(장소 등)는 보여주지 않고 제목만 표시 */}
                          <div className="space-y-1.5">
                            {visibleEvents.map((event: any, idx: number) => {
                              const isRecurring = getRecurrenceType(event) !== 'none';
                              return <div key={idx} onClick={(e) => { e.stopPropagation(); openEditEvent(event); }} className={`py-1 px-2 rounded-full text-xs font-bold border-l-4 truncate flex items-center gap-1.5 min-w-0 ${isRecurring ? 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/20 dark:border-violet-400 dark:text-violet-100' : event.color === 'green' ? 'bg-emerald-50 border-emerald-600 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-100' : event.color === 'rose' ? 'bg-rose-50 border-rose-600 text-rose-900 dark:bg-rose-500/20 dark:border-rose-500 dark:text-rose-100' : event.color === 'amber' ? 'bg-amber-50 border-amber-600 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500 dark:text-amber-100' : event.color === 'violet' ? 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/20 dark:border-violet-500 dark:text-violet-100' : 'bg-blue-50 border-blue-600 text-blue-900 dark:bg-blue-500/20 dark:border-blue-500 dark:text-blue-100'}`}><span className="truncate">{event.title}</span></div>;
                            })}
                            {hiddenCount > 0 && <div onClick={(e) => { e.stopPropagation(); setDayViewDate(day); }} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-1.5 hover:text-blue-500 dark:hover:text-blue-400">+{hiddenCount}개 더</div>}
                          </div>
                        </>
                      )}
                    </div>;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isModalOpen && <EventModal date={selectedDate} editingEvent={editingEvent} user={user} notify={onNotify} onClose={closeModal} onRefresh={onRefresh} />}
      {dayViewDate && <DayViewModal date={dayViewDate} events={events} holidayMap={holidayMap} user={user} onNotify={onNotify} onRefresh={onRefresh} onClose={() => setDayViewDate(null)} />}
    </div>
  );
}
