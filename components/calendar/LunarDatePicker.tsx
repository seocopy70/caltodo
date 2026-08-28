'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import KoreanLunarCalendar from 'korean-lunar-calendar';

function getLunarLabel(date: Date) {
  const cal = new KoreanLunarCalendar();
  cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = cal.getLunarCalendar();
  return `${lunar.intercalation ? '윤' : ''}${lunar.month}.${lunar.day}`;
}

/**
 * 음력 기념일을 등록할 때, 날짜 칸마다 음력 날짜를 함께 보여주는 달력.
 * 네이티브 <input type=date>는 양력만 보여줘서, 사용자가 원하는 음력 날짜에 해당하는
 * 양력 날짜를 직접 찾기 어려웠던 문제를 해결하기 위한 보조 달력.
 */
export default function LunarDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  const monthStart = startOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <button type="button" onClick={() => setViewMonth((d) => subMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-bold">{format(viewMonth, 'yyyy년 M월', { locale: ko })}</span>
        <button type="button" onClick={() => setViewMonth((d) => addMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, monthStart);
          const isSelected = isSameDay(day, selected);
          return (
            <button
              type="button"
              key={i}
              onClick={() => onChange(format(day, 'yyyy-MM-dd'))}
              className={`flex flex-col items-center justify-center rounded-lg py-1 transition ${isSelected ? 'bg-blue-600 text-white' : inMonth ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : 'opacity-30'}`}
            >
              <span className="text-xs font-bold">{format(day, 'd')}</span>
              <span className={`text-[9px] leading-tight ${isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-600'}`}>{getLunarLabel(day)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
