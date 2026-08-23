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

function getLunarLabel(date: Date) {
  const cal = new KoreanLunarCalendar();
  cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = cal.getLunarCalendar();
  return `${lunar.intercalation ? '윤' : ''}${lunar.month}.${lunar.day}`;
}

const YEAR_RANGE = 15;

export default function Calendar({ view, events, user, onNotify, onRefresh }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const notify = onNotify || (() => {});

  const monthStart = startOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({
    start: view === 'month' ? startOfWeek(monthStart) : weekStart,
    end: view === 'month' ? endOfWeek(endOfMonth(monthStart)) : endOfWeek(currentDate),
  });

  const weekOfMonth = Math.ceil((currentDate.getDate() + startOfMonth(currentDate).getDay()) / 7);
  const yearFrom = currentDate.getFullYear() - YEAR_RANGE;
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => yearFrom + i);
  const holidayMap = getKoreanHolidaysForYears(days.map((d) => d.getFullYear()));

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const openNewEvent = (day: Date) => {
    setSelectedDate(day);
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const openEditEvent = (event: any) => {
    setEditingEvent(event);
    setSelectedDate(event.start);
    setIsModalOpen(true);
  };

  const jumpTo = (year: number, month: number) => {
    setCurrentDate(new Date(year, month, 1));
    setIsDatePickerOpen(false);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setIsDatePickerOpen((v) => !v)}
          className="group flex items-center gap-2 text-left rounded-xl px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="연월 선택"
        >
          <h2 className="text-2xl font-bold">
            {view === 'month' ? format(currentDate, 'yyyy년 MMMM', { locale: ko }) : `${format(currentDate, 'M', { locale: ko })}월 ${weekOfMonth}주차`}
          </h2>
          <CalendarDays className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
        </button>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronLeft/></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700">오늘</button>
          <button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition"><ChevronRight/></button>
        </div>
      </div>

      {isDatePickerOpen && (
        <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">연월로 바로 이동</div>
            <button onClick={() => setIsDatePickerOpen(false)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">닫기</button>
          </div>
          <div className="flex gap-3 mb-3">
            <select
              value={currentDate.getFullYear()}
              onChange={(e) => jumpTo(Number(e.target.value), currentDate.getMonth())}
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold outline-none"
            >
              {years.map((year) => <option key={year} value={year}>{year}년</option>)}
            </select>
            <div className="flex-[2] grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, month) => (
                <button
                  key={month}
                  onClick={() => jumpTo(currentDate.getFullYear(), month)}
                  className={`rounded-lg px-2 py-2 text-xs font-bold transition ${
                    month === currentDate.getMonth()
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {month + 1}월
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 mb-4 text-center text-xs font-black text-slate-500">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={i === 0 ? 'text-rose-500 dark:text-rose-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : ''}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xl bg-white/70 dark:bg-slate-900/20">
        {days.map((day, i) => {
          const dayEvents = events.filter((e: any) => eventOccursOnDay(e, day));
          const isToday = isSameDay(day, new Date());
          const dow = day.getDay();
          const dateKey = format(day, 'yyyy-MM-dd');
          const holidayName = holidayMap[dateKey];
          const lunarLabel = getLunarLabel(day);

          const dateColorClass = isToday
            ? ''
            : holidayName || dow === 0
              ? 'text-rose-500 dark:text-rose-400'
              : dow === 6
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400';

          return (
            <div
              key={i}
              onClick={() => openNewEvent(day)}
              className={`min-h-[120px] p-2 border-r border-b border-slate-200 dark:border-slate-700/30 transition-all cursor-pointer hover:bg-blue-500/5
                ${view === 'month' && !isSameMonth(day, monthStart) ? 'opacity-40 dark:opacity-10' : ''}
                ${isToday ? 'bg-blue-50 dark:bg-blue-500/10' : ''}
                ${view === 'week' ? 'min-h-[400px]' : ''}`}
            >
              <div className="text-center mb-1">
                <div className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : dateColorClass}`}>
                  {format(day, 'd')}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-600 leading-tight">{lunarLabel}</div>
                {holidayName && (
                  <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold truncate leading-tight">{holidayName}</div>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((event: any, idx: number) => {
                  const recurrenceType = getRecurrenceType(event);
                  const isRecurring = recurrenceType !== 'none';
                  const isImported = event.source === 'google_ics';
                  const isMultiDay = !!event.endDate;
                  const timeLabel = format(event.start, 'HH:mm');
                  return (
                    <div
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); openEditEvent(event); }}
                      className={`p-1.5 rounded-md text-[10px] font-bold border-l-4 truncate flex items-center gap-1 min-w-0
                        ${isRecurring
                          ? 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/20 dark:border-violet-400 dark:text-violet-100'
                          : isImported
                            ? 'bg-teal-50 border-teal-600 text-teal-900 dark:bg-teal-500/15 dark:border-teal-400 dark:text-teal-100'
                            : event.color === 'green'
                              ? 'bg-emerald-50 border-emerald-600 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-100'
                              : event.color === 'rose'
                                ? 'bg-rose-50 border-rose-600 text-rose-900 dark:bg-rose-500/20 dark:border-rose-500 dark:text-rose-100'
                                : event.color === 'amber'
                                  ? 'bg-amber-50 border-amber-600 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500 dark:text-amber-100'
                                  : event.color === 'violet'
                                    ? 'bg-violet-100 border-violet-600 text-violet-900 dark:bg-violet-500/20 dark:border-violet-500 dark:text-violet-100'
                                    : 'bg-blue-50 border-blue-600 text-blue-900 dark:bg-blue-500/20 dark:border-blue-500 dark:text-blue-100'
                        }`}
                    >
                      {isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                      {isMultiDay && <CalendarRange className="w-2.5 h-2.5 shrink-0" />}
                      <span className="truncate">{event.title}</span>
                      {view === 'month' && event.start && <span className="shrink-0 font-semibold opacity-75">{timeLabel}</span>}
                      {view === 'week' && <div className="text-[8px] opacity-75 shrink-0">{timeLabel}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <EventModal date={selectedDate} editingEvent={editingEvent} user={user} notify={notify} onClose={closeModal} onRefresh={onRefresh} />
      )}
    </div>
  );
}
