'use client';

import { useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, addDays, subDays
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Repeat, CalendarRange, CalendarDays } from 'lucide-react';
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

const YEAR_RANGE = 15;
const MONTH_CELL_MAX_EVENTS = 3; // 날짜 아래 최대 3개까지만 보여주고, 넘치면 "+N개 더"로 요약
const MONTH_CELL_HEIGHT = 150; // 날짜+음력, 공휴일, 일정 3줄이 항상 들어가는 고정 높이(주마다 칸 높이가 달라지지 않게)

export default function Calendar({ initialView = 'month', events, user, onNotify, onRefresh }: any) {
  const [view, setCalView] = useState<'month' | 'week'>(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dayViewDate, setDayViewDate] = useState<Date | null>(null);
  const monthStart = startOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({ start: view === 'month' ? startOfWeek(monthStart) : weekStart, end: view === 'month' ? endOfWeek(endOfMonth(monthStart)) : endOfWeek(currentDate) });
  const weekOfMonth = Math.ceil((currentDate.getDate() + startOfMonth(currentDate).getDay()) / 7);
  const yearFrom = currentDate.getFullYear() - YEAR_RANGE;
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => yearFrom + i);
  const holidayMap = getKoreanHolidaysForYears(days.map((d) => d.getFullYear()));

  const closeModal = () => { setIsModalOpen(false); setEditingEvent(null); };
  const openNewEvent = (day: Date) => { setSelectedDate(day); setEditingEvent(null); setIsModalOpen(true); };
  const openEditEvent = (event: any) => { setEditingEvent(event); setSelectedDate(event.start); setIsModalOpen(true); };
  const jumpTo = (year: number, month: number) => { setCurrentDate(new Date(year, month, 1)); setIsDatePickerOpen(false); };

  const handleDayClick = (day: Date) => {
    const hasEvents = events.some((e: any) => eventOccursOnDay(e, day));
    if (hasEvents) setDayViewDate(day);
    else openNewEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0));
  };

  const handleSlotClick = (day: Date, hour: number) => {
    openNewEvent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setIsDatePickerOpen((v) => !v)} className="group flex items-center gap-2 text-left rounded-xl px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="연월 선택"><h2 className="text-2xl font-bold">{view === 'month' ? format(currentDate, 'yyyy년 MMMM', { locale: ko }) : `${format(currentDate, 'M', { locale: ko })}월 ${weekOfMonth}주차`}</h2><CalendarDays className="w-5 h-5 text-slate-400 group-hover:text-blue-500" /></button>
        <div className="flex items-center gap-2">
          {/* 월별/주별보기를 두 개의 버튼이 아니라, 한 자리에서 탭하면 전환되는 슬라이딩 토글 하나로 */}
          <button
            type="button"
            onClick={() => setCalView((v) => (v === 'month' ? 'week' : 'month'))}
            title={view === 'month' ? '탭하면 주별보기로' : '탭하면 월별보기로'}
            className="relative flex items-center w-[84px] h-9 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0"
          >
            <span className={`absolute top-0.5 bottom-0.5 w-10 rounded-full bg-blue-600 transition-transform duration-200 ${view === 'week' ? 'translate-x-[40px]' : 'translate-x-0.5'}`} />
            <span className={`relative z-10 flex-1 text-center text-xs font-bold transition-colors ${view === 'month' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>월</span>
            <span className={`relative z-10 flex-1 text-center text-xs font-bold transition-colors ${view === 'week' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>주</span>
          </button>
          <div className="flex gap-2"><button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronLeft/></button><button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700">오늘</button><button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronRight/></button></div>
        </div>
      </div>

      {isDatePickerOpen && <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4"><div className="flex items-center justify-between mb-3"><div className="text-sm font-bold text-slate-700 dark:text-slate-200">연월로 바로 이동</div><button onClick={() => setIsDatePickerOpen(false)} className="text-xs text-slate-500">닫기</button></div><div className="flex gap-3 mb-3"><select value={currentDate.getFullYear()} onChange={(e) => jumpTo(Number(e.target.value), currentDate.getMonth())} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold outline-none">{years.map((year) => <option key={year} value={year}>{year}년</option>)}</select><div className="flex-[2] grid grid-cols-6 gap-1.5">{Array.from({ length: 12 }, (_, month) => <button key={month} onClick={() => jumpTo(currentDate.getFullYear(), month)} className={`rounded-lg px-2 py-2 text-xs font-bold ${month === currentDate.getMonth() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{month + 1}월</button>)}</div></div></div>}

      {view === 'week' ? (
        <TimeGrid days={days} events={events} holidayMap={holidayMap} onSlotClick={handleSlotClick} onEventClick={openEditEvent} onDayHeaderClick={(day: Date) => setDayViewDate(day)} />
      ) : (
        <>
          {/* touch-pan-x만 걸려있으면(이전 방식) 이 영역 안에서 시작한 세로 스와이프가 페이지 스크롤로
              이어지지 못해 "월별보기에서 위아래 스크롤이 안 되는" 문제가 있었음 — x/y 모두 허용. */}
          <div data-hscroll className="overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl bg-white/70 dark:bg-slate-900/20">
            <div style={{ minWidth: 7 * 120 }}>
            <div className="grid grid-cols-7 text-center text-xs font-black text-slate-500 border-b border-slate-200 dark:border-slate-700/30 py-1.5">{['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={i === 0 ? 'text-rose-500 dark:text-rose-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : ''}>{d}</div>)}</div>
            {Array.from({ length: days.length / 7 }, (_, weekIdx) => {
              const week = days.slice(weekIdx * 7, weekIdx * 7 + 7);
              return (
                // 모든 주(週)가 항상 동일한 높이를 쓰도록 고정(일정 3개 + 공휴일 표시가 들어갈 정도).
                // 넘치는 일정은 늘어나지 않고 "+N개 더" 표시로 요약해서, 주마다 칸 높이가 들쭉날쭉해지지 않게 함.
                <div key={weekIdx} className="grid border-b border-slate-200 dark:border-slate-700/30 last:border-b-0" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                  {week.map((day, i) => {
                    const dayEvents = events.filter((e: any) => eventOccursOnDay(e, day));
                    const visibleEvents = dayEvents.slice(0, MONTH_CELL_MAX_EVENTS);
                    const hiddenCount = dayEvents.length - visibleEvents.length;
                    const isToday = isSameDay(day, new Date());
                    const dow = day.getDay();
                    const holidayName = holidayMap[format(day, 'yyyy-MM-dd')];
                    const lunarLabel = getLunarLabel(day);
                    const dateColorClass = isToday ? '' : holidayName || dow === 0 ? 'text-rose-500 dark:text-rose-400' : dow === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400';
                    return <div key={i} onClick={() => handleDayClick(day)} style={{ height: MONTH_CELL_HEIGHT }} className={`p-1.5 border-r border-slate-200 dark:border-slate-700/30 last:border-r-0 transition-all cursor-pointer hover:bg-blue-500/5 overflow-hidden ${!isSameMonth(day, monthStart) ? 'opacity-40 dark:opacity-10' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <div className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : dateColorClass}`}>{format(day, 'd')}</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-600 leading-tight">{lunarLabel}</div>
                      </div>
                      {holidayName && <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate leading-tight text-center mb-1">{holidayName}</div>}
                      {/* 월별보기에서는 칸이 좁아 추가정보(장소 등)는 보여주지 않고 제목만 표시 */}
                      <div className="space-y-1.5">
                        {visibleEvents.map((event: any, idx: number) => {
                          const isRecurring = getRecurrenceType(event) !== 'none';
                          const isMultiDay = !!event.endDate;
                          return <div key={idx} onClick={(e) => { e.stopPropagation(); openEditEvent(event); }} className={`py-1 px-1.5 rounded-md text-xs font-bold border-l-4 truncate flex items-center gap-1.5 min-w-0 ${isRecurring ? 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/20 dark:border-violet-400 dark:text-violet-100' : event.color === 'green' ? 'bg-emerald-50 border-emerald-600 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-100' : event.color === 'rose' ? 'bg-rose-50 border-rose-600 text-rose-900 dark:bg-rose-500/20 dark:border-rose-500 dark:text-rose-100' : event.color === 'amber' ? 'bg-amber-50 border-amber-600 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500 dark:text-amber-100' : event.color === 'violet' ? 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/20 dark:border-violet-500 dark:text-violet-100' : 'bg-blue-50 border-blue-600 text-blue-900 dark:bg-blue-500/20 dark:border-blue-500 dark:text-blue-100'}`}>{isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0"/>}{isMultiDay && <CalendarRange className="w-2.5 h-2.5 shrink-0"/>}<span className="truncate">{event.title}</span></div>;
                        })}
                        {hiddenCount > 0 && <div onClick={(e) => { e.stopPropagation(); setDayViewDate(day); }} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-1.5 hover:text-blue-500 dark:hover:text-blue-400">+{hiddenCount}개 더</div>}
                      </div>
                    </div>;
                  })}
                </div>
              );
            })}
            </div>
          </div>
        </>
      )}

      {isModalOpen && <EventModal date={selectedDate} editingEvent={editingEvent} user={user} notify={onNotify} onClose={closeModal} onRefresh={onRefresh} />}
      {dayViewDate && <DayViewModal date={dayViewDate} events={events} holidayMap={holidayMap} user={user} onNotify={onNotify} onRefresh={onRefresh} onClose={() => setDayViewDate(null)} />}
    </div>
  );
}
