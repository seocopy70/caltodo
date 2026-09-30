'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, addDays, subDays, getYear, startOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Grid3x3, Rows3, Columns3, Maximize2, Minimize2, MapPin, AlignLeft } from 'lucide-react';
import { getKoreanHolidaysForYears } from '../../lib/holidays';
import { eventOccursOnDay, getRecurrenceType, getOccurrenceTimes } from '../../lib/recurrence';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import EventModal from '../calendar/EventModal';
import DayViewModal from '../calendar/DayViewModal';
import TimeGrid from '../calendar/TimeGrid';
import YearOverviewModal from '../calendar/YearOverviewModal';
import { usePinchGesture } from '../../lib/usePinchGesture';

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

// 일정 목록 보기(예전 메뉴의 "일정 목록 보기"를 대체): 처음엔 올해만 펼쳐서 오늘 위치에 맞춰 보여주고,
// 상단 "오늘" 버튼(jumpTick)으로 언제든 오늘 위치로 돌아오며, allOpen 토글로 모든 연도를 열고 닫는다.
function CalendarEventList({ events, ascending, allOpen, jumpTick, onEventClick }: any) {
  const currentYear = new Date().getFullYear();
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({ [String(currentYear)]: true });
  const todayRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const map = new Map<number, any[]>();
    [...events]
      .sort((a: any, b: any) => (ascending ? a.start.getTime() - b.start.getTime() : b.start.getTime() - a.start.getTime()))
      .forEach((e: any) => {
        const y = getYear(e.start);
        if (!map.has(y)) map.set(y, []);
        map.get(y)!.push(e);
      });
    // 올해 일정이 하나도 없어도 "오늘" 위치 표시가 있도록 올해 묶음은 항상 만든다.
    if (!map.has(currentYear)) map.set(currentYear, []);
    return Array.from(map.entries()).sort((a, b) => (ascending ? a[0] - b[0] : b[0] - a[0]));
  }, [events, ascending, currentYear]);
  const yearsRef = useRef(years);
  yearsRef.current = years;

  const scrollToToday = (behavior: ScrollBehavior) => {
    setOpenYears((prev) => ({ ...prev, [String(currentYear)]: true }));
    setTimeout(() => todayRef.current?.scrollIntoView({ behavior, block: 'center' }), 50);
  };

  // 처음 열릴 때: 일정 데이터가 실제로 들어온 뒤 딱 한 번 오늘 위치로 이동(데이터가 비동기로 채워질 수 있음)
  const didAutoJumpRef = useRef(false);
  useEffect(() => {
    if (didAutoJumpRef.current || events.length === 0) return;
    didAutoJumpRef.current = true;
    scrollToToday('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  // 상단 "오늘" 버튼
  const firstJumpRef = useRef(true);
  useEffect(() => {
    if (firstJumpRef.current) { firstJumpRef.current = false; return; }
    scrollToToday('smooth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTick]);

  // 정렬 방향을 바꾸면 순서가 뒤집혀 위치를 잃기 쉬우므로 오늘 위치로 다시 맞춤
  const firstSortRef = useRef(true);
  useEffect(() => {
    if (firstSortRef.current) { firstSortRef.current = false; return; }
    scrollToToday('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ascending]);

  // 모두 열기 / 닫기(닫기 = 올해만 열린 처음 상태)
  const firstAllOpenRef = useRef(true);
  useEffect(() => {
    if (firstAllOpenRef.current) { firstAllOpenRef.current = false; return; }
    if (allOpen) setOpenYears(Object.fromEntries(yearsRef.current.map(([y]) => [String(y), true])));
    else { setOpenYears({ [String(currentYear)]: true }); scrollToToday('auto'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOpen]);

  const toggleYear = (year: number) => setOpenYears((prev) => ({ ...prev, [String(year)]: !prev[String(year)] }));

  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const todayEnd = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).getTime();

  return (
    <div className="space-y-2 pb-3">
      {years.every(([, list]) => list.length === 0) && <div className="text-center text-slate-500 py-6 text-sm">등록된 일정이 없습니다.</div>}
      {years.map(([year, yearEvents]: [number, any[]]) => {
        const open = !!openYears[String(year)];
        const isCurrent = year === currentYear;
        const markerIndex = isCurrent
          ? (() => { const i = yearEvents.findIndex((e: any) => (ascending ? e.start.getTime() >= todayStart : e.start.getTime() < todayEnd)); return i < 0 ? yearEvents.length : i; })()
          : -1;
        return (
          <section key={year} className="space-y-1.5">
            <button type="button" onClick={() => toggleYear(year)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
              <span className="font-black text-base">{year}년 {isCurrent && <span className="text-[10px] text-blue-500 dark:text-blue-400 ml-1">올해</span>}</span>
              {open ? <ChevronLeft className="w-4 h-4 rotate-[-90deg]" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {open && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/30">
                {yearEvents.length === 0 && !isCurrent && <div className="text-center text-slate-500 py-7 text-sm">일정이 없습니다.</div>}
                {yearEvents.map((event: any, idx: number) => {
                  const repeated = getRecurrenceType(event) !== 'none';
                  const isTodayEvent = event.start.getTime() >= todayStart && event.start.getTime() < todayEnd;
                  return (
                    <div key={event.id}>
                      {idx === markerIndex && <TodayMarker markerRef={todayRef} now={now} />}
                      <div onClick={() => onEventClick?.(event)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-blue-500/5 ${repeated ? 'bg-violet-50 dark:bg-violet-500/10' : ''} ${isTodayEvent ? 'ring-2 ring-inset ring-blue-500/60' : ''}`}>
                        <div className="w-16 shrink-0 flex flex-col items-start leading-tight">
                          <span className="text-[15px] font-black text-blue-600 dark:text-blue-400">{format(event.start, 'M/d')}</span>
                          <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{format(event.start, 'HH:mm')}</span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[15px] truncate">{event.title}</span>
                          {event.location ? <span className="text-[15px] text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" />{event.location}</span> : event.description ? <span className="text-[15px] text-slate-500 dark:text-slate-400 flex items-center gap-1 min-w-0 truncate"><AlignLeft className="w-3.5 h-3.5 shrink-0" />{event.description}</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {markerIndex >= yearEvents.length && <TodayMarker markerRef={todayRef} now={now} />}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TodayMarker({ markerRef, now }: { markerRef: React.RefObject<HTMLDivElement>; now: Date }) {
  return (
    <div ref={markerRef} className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/5">
      <div className="h-px flex-1 bg-blue-500/60" />
      <span className="text-xs font-black text-blue-500 dark:text-blue-400 whitespace-nowrap">오늘 · {format(now, 'M월 d일 (EEE)', { locale: ko })}</span>
      <div className="h-px flex-1 bg-blue-500/60" />
    </div>
  );
}

export default function Calendar({ initialView = 'month', events, user, onNotify, onRefresh, onAddEvent, onPatchEvent, onRemoveEvent, onReconcileEvent, swipeMode = 'date' }: any) {
  const [view, setCalView] = useState<'month' | 'week' | 'list'>(initialView === 'week' ? 'week' : 'month');
  // 일정 목록 보기 전용 상태: 모든 연도 열기 여부 / 정렬 방향(시간순=오래된 것부터) / 상단 "오늘" 버튼 신호
  const [listAllOpen, setListAllOpen] = useState(false);
  const [listAscending, setListAscending] = useState(true);
  const [listJumpTick, setListJumpTick] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const monthGridWrapperRef = useRef<HTMLDivElement>(null);
  const weekGridWrapperRef = useRef<HTMLDivElement>(null);
  // 폰 좁은 화면에서 "넓게보기"를 켜면 폰 넓은화면 기본 폭으로 일정표를 보여주고(좌우) 그 안에서만
  // 좌우로 스크롤함. 월별보기에서는 동시에 화면에 맞춘 고정 높이도 풀어서, 그 주(週)에서 일정이
  // 가장 많은 날짜 기준으로 칸 높이도 늘어나 모든 일정이 잘리지 않고 다 보임(아래로도 확장).
  const [wideView, setWideView] = useState(false);
  // 태블릿/데스크톱처럼 화면이 이미 넓은 경우엔 좌우로 늘릴 필요는 없지만, 칸이 좁아 일정이 잘리는
  // 건 똑같이 생길 수 있어서 별도의 "펼치기" 버튼을 둠(모바일 넓게보기와 아이콘은 같지만 좌우 확장 없이
  // 세로(칸 높이)만 늘림). 아래 monthExpanded가 실제 렌더링에서 쓰는 값 — 둘 중 하나라도 켜져 있으면 적용.
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const monthExpanded = wideView || desktopExpanded;

  // 두 손가락 벌리기 = 펼치기(넓게보기), 좁히기 = 화면에 맞춰 보기 — 툴바의 펼치기/넓게보기 버튼과 정확히 같은 동작.
  // 폰 좁은 화면(<640px)에서는 "넓게보기"(월/주 모두), 넓은 화면에서는 "펼치기"(월별보기만)가 그 버튼이므로 그 상태를 그대로 바꿈.
  // 일정 수정창/하루보기/연도선택창이 열려있을 땐 그 위에서의 제스처가 뒤의 일정표를 바꾸지 않도록 무시.
  const calRootRef = useRef<HTMLDivElement>(null);
  const applyPinchExpand = (expand: boolean) => {
    if (isModalOpen || dayViewDate || isDatePickerOpen) return;
    if (view === 'list') { setListAllOpen(expand); return; }
    const isWideScreen = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
    if (isWideScreen) { if (view === 'month') setDesktopExpanded(expand); }
    else setWideView(expand);
  };
  usePinchGesture(calRootRef, { onSpread: () => applyPinchExpand(true), onPinch: () => applyPinchExpand(false) });
  // 월별보기가 펼쳐져서 화면보다 커질 때, 주별보기처럼 요일칸(일 월 화 수 목 금 토) 줄과 그 위
  // 툴바는 그대로 있고 날짜 칸들만 그 안에서 스크롤되게 하기 위해, 요일칸 줄의 실제 높이를 측정해둠
  // (전체 사용 가능 높이에서 이 만큼을 빼야 날짜 칸 스크롤 영역의 높이를 정확히 구할 수 있음).
  const monthHeaderRowRef = useRef<HTMLDivElement>(null);
  const [monthHeaderRowH, setMonthHeaderRowH] = useState<number | null>(null);
  useEffect(() => {
    const el = monthHeaderRowRef.current;
    if (!el) return;
    const update = () => setMonthHeaderRowH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  // 펼쳐서(monthExpanded) 화면보다 커질 때, 요일칸 줄+툴바는 그대로 두고 날짜 칸들만 그 안에서
  // 스크롤되도록(주별보기와 동일한 방식) 스크롤 영역의 높이를 계산 — 전체 사용가능 높이에서
  // 요일칸 줄 높이만큼 뺌.
  const weeksMaxHeight = monthExpanded && monthAvailableHeight != null && monthHeaderRowH != null
    ? Math.max(monthAvailableHeight - monthHeaderRowH, 120)
    : undefined;
  const weekOfMonth = Math.ceil((currentDate.getDate() + startOfMonth(currentDate).getDay()) / 7);
  const holidayYears = Array.from(new Set(days.map((d) => d.getFullYear())));
  const [governmentHolidayMap, setGovernmentHolidayMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const loadGovernmentHolidays = async () => {
      try {
        const response = await fetch(`/api/holidays?years=${holidayYears.join(',')}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.holidays) setGovernmentHolidayMap(data.holidays);
      } catch {
        // 정부 API/네트워크가 일시적으로 unavailable하면 아래의 로컬 계산값을 사용한다.
      }
    };
    loadGovernmentHolidays();
    return () => { cancelled = true; };
  }, [holidayYears.join(',')]);

  // 정부 공공데이터가 있으면 그것을 우선하고, 아직 동기화되지 않은 연도는 기존 계산기를 fallback으로 사용한다.
  const holidayMap = {
    ...getKoreanHolidaysForYears(holidayYears),
    ...governmentHolidayMap,
  };

  const closeModal = () => { setIsModalOpen(false); setEditingEvent(null); };
  const openNewEvent = (day: Date) => { setSelectedDate(day); setEditingEvent(null); setIsModalOpen(true); };
  const openEditEvent = (event: any) => { setEditingEvent(event); setSelectedDate(event.start); setIsModalOpen(true); };
  // 12개월 한눈에 보기 모달에서 월 제목을 누르면 그 달로, 날짜를 누르면 그 날짜(일별보기)로 이동
  const jumpToMonth = (year: number, month: number) => setCurrentDate(new Date(year, month, 1));

  const handleDayClick = (day: Date) => {
    // 일정 유무와 상관없이 날짜를 탭하면 항상 일별보기를 띄움(일정 없는 날에도 그 안에서 새 일정 추가 가능)
    setDayViewDate(day);
  };

  const handleSlotClick = (day: Date, hour: number) => {
    openNewEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0));
  };

  // 일정탭 안에서 좌우로 스와이프하면 월/주를 이동(탭 전환은 page.tsx가 세로 스와이프로 별도 처리).
  // 넓게보기 상태에서는 가로 스와이프가 이미 "넓혀진 그리드를 옆으로 보기" 용도라 겹치지 않도록 비활성.
  const gridTouchStart = useRef<{ x: number; y: number } | null>(null);
  const handleGridTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) { gridTouchStart.current = null; return; } // 두 손가락(핀치)은 월/주 이동 스와이프가 아님
    gridTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleGridTouchEnd = (e: React.TouchEvent) => {
    const start = gridTouchStart.current;
    gridTouchStart.current = null;
    // swipeMode가 'date'가 아니면(위/아래로 스와이프해서 "탭 이동" 모드로 바꿔둔 상태) 여기서는 아무것도
    // 하지 않고 그대로 두어, 이 가로 스와이프가 상위(page.tsx)의 탭 전환 처리로 이어지게 함
    if (wideView || isDatePickerOpen || swipeMode !== 'date' || !start) return;
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;
    // 위아래로 스크롤하려던 움직임이 옆으로 살짝 밀렸다고 달이 바뀌지 않도록, 가로가 세로의 1.5배 이상일 때만 인정
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    const MIN_SWIPE_PX = 60; // 살짝 삐끗한 정도(탭 중 미세한 흔들림)까지 스와이프로 오인하지 않도록
    if (Math.abs(deltaX) < MIN_SWIPE_PX) return;
    // 왼쪽으로 밀면 다음(달/주), 오른쪽으로 밀면 이전(달/주)
    if (deltaX < 0) setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7));
    else setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7));
  };

  // 월별보기 날짜 칸들(주 단위 행) — 펼쳐졌을 때(monthExpanded) 요일칸 줄 아래에서 이 부분만 따로
  // 스크롤되게 하려고, JSX 안에 바로 두지 않고 변수로 미리 만들어서 두 군데(스크롤 래퍼로 감싸는
  // 경우/안 감싸는 경우)에서 그대로 재사용함.
  const weekRows = Array.from({ length: numWeeks }, (_, weekIdx) => {
    const week = days.slice(weekIdx * 7, weekIdx * 7 + 7);
    return (
      // 모든 주(週)가 동일한 높이를 쓰도록 화면에 맞춰 계산된 높이로 고정.
      // 넘치는 일정은 늘어나지 않고 "+N개 더" 표시(또는 좁을 땐 점)로 요약해서, 화면 밖으로 넘치지 않게 함.
      <div key={weekIdx} className="grid border-b border-slate-100 dark:border-slate-800/60 last:border-b-0" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {week.map((day, i) => {
          // 하루에 일정이 여럿이면 시간순(이른 시간 먼저)으로 정렬해서 보여줌(반복일정은 그 날짜 기준 실제 발생 시간으로 계산)
          const dayEvents = events
            .filter((e: any) => eventOccursOnDay(e, day))
            .sort((a: any, b: any) => getOccurrenceTimes(a, day).start.getTime() - getOccurrenceTimes(b, day).start.getTime());
          // 펼치기 상태면 그 칸만 다 보여주는 게 아니라, 잘림 없이 전부 보여주고 칸 높이는
          // CSS grid가 그 주(週) 안에서 가장 내용이 많은 요일에 맞춰 자동으로 늘려줌(같은 주는 항상 같은 높이).
          const visibleEvents = monthExpanded ? dayEvents : dayEvents.slice(0, monthCellMaxChips);
          const hiddenCount = monthExpanded ? 0 : dayEvents.length - visibleEvents.length;
          const isToday = isSameDay(day, new Date());
          const dow = day.getDay();
          const holidayName = holidayMap[format(day, 'yyyy-MM-dd')];
          const lunarLabel = showLunarLabel ? getLunarLabel(day) : null;
          const dateColorClass = isToday ? '' : holidayName || dow === 0 ? 'text-rose-500 dark:text-rose-400' : dow === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400';
          return <div key={i} onClick={() => openNewEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0))} style={monthExpanded ? { minHeight: monthCellHeight } : { height: monthCellHeight }} className={`p-1.5 border-r border-slate-100 dark:border-slate-800/60 last:border-r-0 transition-all cursor-pointer hover:bg-blue-500/5 ${monthExpanded ? '' : 'overflow-hidden'} ${!isSameMonth(day, monthStart) ? 'opacity-40 dark:opacity-10' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <div onClick={(e) => { e.stopPropagation(); handleDayClick(day); }} className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : dateColorClass}`}>{format(day, 'd')}</div>
              {lunarLabel && <div className="text-[9px] text-slate-400 dark:text-slate-600 leading-tight">{lunarLabel}</div>}
            </div>
            {holidayName && <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate leading-tight text-center mb-1">{holidayName}</div>}
            {(!monthExpanded && monthEventMode === 'dots') ? (
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
  });

  return (
    <div ref={calRootRef} className="flex flex-col h-full animate-in fade-in duration-500">
      {/* 목록 보기에서는 툴바를 헤더 바로 아래에 붙여(sticky), 목록을 한참 내려도 오늘/전체열기/정렬 버튼을 바로 쓸 수 있게 함.
          top 값은 page.tsx가 측정해 두는 실제 헤더 높이(--app-header-h). */}
      <div
        className={`flex items-center gap-2 mb-3 flex-wrap gap-y-2 ${view === 'list' ? 'sticky z-20 -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 py-2 mb-1 bg-slate-50/95 dark:bg-[#0f172a]/95 backdrop-blur' : ''}`}
        style={view === 'list' ? { top: 'var(--app-header-h, 56px)' } : undefined}
      >
        {view === 'list' ? (
          <h2 className="text-lg sm:text-2xl font-bold whitespace-nowrap px-2 py-1 shrink-0">일정 목록</h2>
        ) : (
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
        )}

        {/* 월/주 이동 + 오늘 버튼: 줄 가운데. 목록 보기에서는 좌우 이동이 필요 없고, "오늘"은 목록 안에서 오늘 위치로 되돌아오는 용도 */}
        <div className="flex-1 flex justify-center">
          {view === 'list' ? (
            <button onClick={() => setListJumpTick((t) => t + 1)} className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 whitespace-nowrap">오늘</button>
          ) : (
          <div className="flex gap-1.5 sm:gap-2"><button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronLeft/></button><button onClick={() => setCurrentDate(new Date())} className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 whitespace-nowrap">오늘</button><button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronRight/></button></div>
          )}
        </div>

        {/* 토글 버튼들: 줄 오른쪽 끝(펼치기(넓은화면: 펼치기 / 좁은화면: 넓게보기) -> 월/주 토글 순서로 통일) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 화면이 이미 넓은 경우(sm 이상)를 위한 펼치기: 좌우로 늘릴 필요는 없지만, 월별보기 칸 높이는
              그대로 고정이라 일정이 많은 날짜는 잘릴 수 있어서 세로(칸 높이)만 늘려주는 별도 버튼.
              모바일 넓게보기 버튼과 정반대 조건(hidden sm:inline-flex)이라 서로 겹쳐 보이지 않음. */}
          {view === 'list' && (
            <>
              {/* 모든 연도 열기 / 닫기(닫기 = 올해만 열린 상태). 아이콘은 월별보기의 펼치기/줄이기와 동일 */}
              <button
                type="button"
                onClick={() => setListAllOpen((v) => !v)}
                title={listAllOpen ? '탭하면 올해만 열어 보기' : '탭하면 모든 연도 열기'}
                className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0"
              >
                {listAllOpen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              {/* 정렬 토글: 시간순(오래된 것부터) <-> 최신순 */}
              <button
                type="button"
                onClick={() => setListAscending((v) => !v)}
                title={listAscending ? '탭하면 최신순으로' : '탭하면 시간순으로'}
                className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0 text-xs font-bold whitespace-nowrap leading-5"
              >
                {listAscending ? '시간순 ↑' : '최신순 ↓'}
              </button>
            </>
          )}
          {view === 'month' && (
            <button
              type="button"
              onClick={() => setDesktopExpanded((v) => !v)}
              title={desktopExpanded ? '탭하면 화면에 맞춰 보기' : '탭하면 펼쳐서 일정 다 보이게'}
              className="hidden sm:inline-flex py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0"
            >
              {desktopExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          )}
          {/* 넓게보기/맞춤보기 전환: 폰 좁은 화면에서만 의미가 있어서 그 화면에서만 보여줌. 위 데스크톱용
              펼치기 버튼과 자리가 겹쳐 보이도록(항상 "펼치기 -> 월/주 토글" 순서가 되도록) 여기, 월/주
              토글 버튼보다 앞에 둠. 월별보기에서는 좌우(화면 폭)만이 아니라 아래로도(칸 높이) 늘어나서
              일정이 잘리지 않고 다 보임. */}
          <button
            type="button"
            onClick={() => setWideView((v) => !v)}
            title={wideView ? '탭하면 화면에 맞춰 보기' : '탭하면 넓고 길게 보기(일정 다 보이게)'}
            className={`${view === 'list' ? 'hidden' : 'sm:hidden'} py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0`}
          >
            {wideView ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          {/* 월별/주별보기 전환: 메모탭 보기옵션처럼 한 칸짜리 아이콘 토글(탭하면 전환될 모드의 아이콘을 보여줌) */}
          <button
            type="button"
            onClick={() => {
              // 월 -> 주 -> 목록 -> 월. 목록에 들어올 때는 항상 "올해만 열림 + 오늘 위치"의 처음 상태로 시작
              if (view === 'month') setCalView('week');
              else if (view === 'week') { setListAllOpen(false); setListAscending(true); setCurrentDate(new Date()); setCalView('list'); }
              else setCalView('month');
            }}
            title={view === 'month' ? '탭하면 주별보기로' : view === 'week' ? '탭하면 목록보기로' : '탭하면 월별보기로'}
            className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shrink-0"
          >
            {view === 'month' ? <Columns3 className="w-5 h-5" /> : view === 'week' ? <Rows3 className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isDatePickerOpen && (
        <YearOverviewModal
          initialYear={currentDate.getFullYear()}
          onClose={() => setIsDatePickerOpen(false)}
          onPickMonth={jumpToMonth}
        />
      )}

      {view === 'list' ? (
        <CalendarEventList
          events={events}
          ascending={listAscending}
          allOpen={listAllOpen}
          jumpTick={listJumpTick}
          onEventClick={openEditEvent}
        />
      ) : view === 'week' ? (
        <div ref={weekGridWrapperRef} onTouchStart={handleGridTouchStart} onTouchEnd={handleGridTouchEnd}>
          <TimeGrid days={days} events={events} holidayMap={holidayMap} onSlotClick={handleSlotClick} onEventClick={openEditEvent} onDayHeaderClick={(day: Date) => setDayViewDate(day)} availableHeight={weekAvailableHeight} wideView={wideView} />
        </div>
      ) : (
        <div className={wideView ? 'overflow-x-auto -mx-2.5 px-2.5' : ''} data-no-tab-cycle={monthExpanded || undefined} onTouchStart={handleGridTouchStart} onTouchEnd={handleGridTouchEnd}>
        {/* touch-pan-x만 걸려있으면(이전 방식) 이 영역 안에서 시작한 세로 스와이프가 페이지 스크롤로
            이어지지 못해 "월별보기에서 위아래 스크롤이 안 되는" 문제가 있었음 — x/y 모두 허용. */}
        <div ref={monthGridWrapperRef} className={`rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/70 dark:bg-slate-900/20 overflow-hidden ${wideView ? 'min-w-[640px]' : ''}`}>
            <div ref={monthHeaderRowRef} className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800/60 py-1.5">{['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={i === 0 ? 'text-rose-500 dark:text-rose-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : ''}>{d}</div>)}</div>
            {/* 펼쳐서(monthExpanded) 화면보다 커지면, 주별보기처럼 위 요일칸 줄+툴바는 그대로 두고
                날짜 칸들만 이 안에서 스크롤되게 함(원래는 화면에 맞춰 고정 높이라 이 래퍼가 필요 없었음) */}
            {monthExpanded ? (
              <div data-vscroll className="overflow-y-auto touch-pan-x touch-pan-y" style={{ maxHeight: weeksMaxHeight }}>
                {weekRows}
              </div>
            ) : weekRows}
          </div>
        </div>
      )}

      {isModalOpen && <EventModal date={selectedDate} editingEvent={editingEvent} user={user} notify={onNotify} onClose={closeModal} onRefresh={onRefresh} onAddLocal={onAddEvent} onPatchLocal={onPatchEvent} onRemoveLocal={onRemoveEvent} onReconcileLocal={onReconcileEvent} allEvents={events} />}
      {dayViewDate && <DayViewModal date={dayViewDate} events={events} holidayMap={holidayMap} user={user} onNotify={onNotify} onRefresh={onRefresh} onClose={() => setDayViewDate(null)} onAddEvent={onAddEvent} onPatchEvent={onPatchEvent} onRemoveEvent={onRemoveEvent} onReconcileEvent={onReconcileEvent} />}
    </div>
  );
}
