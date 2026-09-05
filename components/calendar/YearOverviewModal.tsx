'use client';

import { useMemo, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getKoreanHolidaysForYears } from '../../lib/holidays';
import { useModalBackClose } from '../../lib/useModalBackClose';

const YEAR_LIST_RANGE = 12; // 연도 선택창에서 위아래로 보여줄 범위
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 연도 전체(1~12월)를 한 화면에서 훑어보는 모달.
 * - 좌우로 스와이프하거나 화살표를 누르면 연도가 바뀜
 * - 맨 위 "OOOO년"을 누르면 연도를 직접 골라 이동하는 목록이 뜸
 * - 월 제목을 누르면 그 달로, 날짜를 누르면 그 날짜로 이동(둘 다 모달은 닫힘)
 */
export default function YearOverviewModal({ initialYear, onClose, onPickMonth, onPickDay }: { initialYear: number; onClose: () => void; onPickMonth: (year: number, month: number) => void; onPickDay: (date: Date) => void; }) {
  useModalBackClose(onClose);
  const [year, setYear] = useState(initialYear);
  const [yearListOpen, setYearListOpen] = useState(false);
  const today = new Date();

  // 12월/1월 걸치는 주가 있을 수 있어 앞뒤 연도 공휴일도 같이 계산
  const holidayMap = useMemo(() => getKoreanHolidaysForYears([year - 1, year, year + 1]), [year]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const monthStart = startOfMonth(new Date(year, m, 1));
    return { month: m, days: eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) }) };
  }), [year]);

  const yearOptions = useMemo(() => Array.from({ length: YEAR_LIST_RANGE * 2 + 1 }, (_, i) => year - YEAR_LIST_RANGE + i), [year]);

  // 그리드 영역 어디서든 좌우로 스와이프하면 연도 이동(위아래는 그냥 화면 스크롤)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    if (Math.abs(deltaX) < 50) return;
    setYear((y) => y + (deltaX < 0 ? 1 : -1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in fade-in duration-150">
      <div className="flex items-center justify-between px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="닫기"><X className="w-5 h-5" /></button>
        <div className="relative flex items-center gap-1">
          <button onClick={() => setYear((y) => y - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="이전 연도"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => setYearListOpen((v) => !v)} className="text-xl font-black px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="연도 선택">{year}년</button>
          <button onClick={() => setYear((y) => y + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="다음 연도"><ChevronRight className="w-5 h-5" /></button>
          {yearListOpen && (
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-10 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 grid grid-cols-3 gap-1 w-56">
              {yearOptions.map((y) => (
                <button key={y} onClick={() => { setYear(y); setYearListOpen(false); }} className={`px-2 py-1.5 rounded-lg text-sm font-bold ${y === year ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>{y}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setYear(today.getFullYear())} className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">오늘</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="grid grid-cols-3 gap-2">
          {months.map(({ month, days }) => (
            <div key={month} className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-1.5">
              <button onClick={() => { onPickMonth(year, month); onClose(); }} className="w-full text-center text-xs font-bold mb-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100">{month + 1}월</button>
              <div className="grid grid-cols-7 text-center text-[9px] text-slate-400 dark:text-slate-600 mb-0.5">
                {WEEKDAY_LABELS.map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((day, i) => {
                  const inMonth = isSameMonth(day, new Date(year, month, 1));
                  const dow = day.getDay();
                  const isHoliday = !!holidayMap[format(day, 'yyyy-MM-dd')];
                  const isTodayCell = isSameDay(day, today);
                  return (
                    <button
                      key={i}
                      disabled={!inMonth}
                      onClick={() => { onPickDay(day); onClose(); }}
                      className={[
                        'text-[10px] leading-4 rounded-sm mx-auto w-4',
                        !inMonth ? 'invisible' : '',
                        isTodayCell ? 'bg-blue-600 text-white font-bold' : (isHoliday || dow === 0) ? 'text-rose-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300',
                      ].join(' ')}
                    >{day.getDate()}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
