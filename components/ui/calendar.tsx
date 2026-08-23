'use client';

import { useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, addDays, subDays
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Repeat, CalendarRange } from 'lucide-react';
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

export default function Calendar({ view, events, user, onNotify }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const notify = onNotify || (() => {});

  const monthStart = startOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({
    start: view === 'month' ? startOfWeek(monthStart) : weekStart,
    end: view === 'month' ? endOfWeek(endOfMonth(monthStart)) : endOfWeek(currentDate),
  });

  const weekOfMonth = Math.ceil((currentDate.getDate() + startOfMonth(currentDate).getDay()) / 7);

  // 표시되는 날짜 범위가 걸친 모든 연도의 공휴일을 미리 계산
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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {view === 'month' ? format(currentDate, 'yyyy년 MMMM', { locale: ko }) : `${format(currentDate, 'M', { locale: ko })}월 ${weekOfMonth}주차`}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition"><ChevronLeft/></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold bg-slate-800 rounded-lg border border-slate-700">오늘</button>
          <button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition"><ChevronRight/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-4 text-center text-xs font-black text-slate-500">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : ''}>{d}</div>
        ))}
      </div>

      <div className={`grid grid-cols-7 flex-1 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl bg-slate-900/20`}>
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
              ? 'text-rose-400'
              : dow === 6
                ? 'text-blue-400'
                : 'text-slate-400';

          return (
            <div
              key={i}
              onClick={() => openNewEvent(day)}
              className={`min-h-[120px] p-2 border-r border-b border-slate-700/30 transition-all cursor-pointer hover:bg-blue-500/5
                ${view === 'month' && !isSameMonth(day, monthStart) ? 'opacity-10' : ''}
                ${isToday ? 'bg-blue-500/10' : ''}
                ${view === 'week' ? 'min-h-[400px]' : ''}`}
            >
              <div className="text-center mb-1">
                <div className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : dateColorClass}`}>
                  {format(day, 'd')}
                </div>
                <div className="text-[9px] text-slate-600 leading-tight">{lunarLabel}</div>
                {holidayName && (
                  <div className="text-[9px] text-rose-400 font-bold truncate leading-tight">{holidayName}</div>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((event: any, idx: number) => {
                  const recurrenceType = getRecurrenceType(event);
                  const isMultiDay = !!event.endDate;
                  return (
                    <div
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); openEditEvent(event); }}
                      className={`p-1.5 rounded-md text-[10px] font-bold border-l-4 truncate flex items-center gap-1
                        ${event.color === 'green' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200' :
                          event.color === 'rose' ? 'bg-rose-500/20 border-rose-500 text-rose-200' :
                          event.color === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-200' :
                          event.color === 'violet' ? 'bg-violet-500/20 border-violet-500 text-violet-200' :
                          'bg-blue-500/20 border-blue-500 text-blue-200'}`}
                    >
                      {recurrenceType !== 'none' && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                      {isMultiDay && <CalendarRange className="w-2.5 h-2.5 shrink-0" />}
                      <span className="truncate">{event.title}</span>
                      {view === 'week' && recurrenceType === 'none' && !isMultiDay && <div className="text-[8px] opacity-60">{format(event.start, 'HH:mm')}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <EventModal date={selectedDate} editingEvent={editingEvent} user={user} notify={notify} onClose={closeModal} />
      )}
    </div>
  );
}
