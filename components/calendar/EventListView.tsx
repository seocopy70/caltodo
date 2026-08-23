'use client';

import { useMemo, useState } from 'react';
import { format, getYear } from 'date-fns';
import { ChevronDown, ChevronRight, Repeat, CalendarRange } from 'lucide-react';
import EventModal from './EventModal';
import { getRecurrenceType } from '../../lib/recurrence';

export default function EventListView({ events, user, onNotify, onRefresh }: any) {
  const currentYear = new Date().getFullYear();
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({ [String(currentYear)]: true });
  const [ascending, setAscending] = useState(true);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const years = useMemo(() => {
    const map = new Map<number, any[]>();
    [...events]
      .sort((a, b) => ascending ? a.start.getTime() - b.start.getTime() : b.start.getTime() - a.start.getTime())
      .forEach((e) => {
        const y = getYear(e.start);
        if (!map.has(y)) map.set(y, []);
        map.get(y)!.push(e);
      });
    return [...map.entries()].sort((a, b) => ascending ? a[0] - b[0] : b[0] - a[0]);
  }, [events, ascending]);

  const toggleYear = (year: number) => setOpenYears((prev) => ({ ...prev, [String(year)]: !prev[String(year)] }));

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">일정 목록</h2>
        <button onClick={() => setAscending((v) => !v)} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs font-bold">
          {ascending ? '시간순 ↑' : '최신순 ↓'}
        </button>
      </div>

      {years.length === 0 && <div className="text-center text-slate-500 py-16">등록된 일정이 없습니다.</div>}

      {years.map(([year, yearEvents]) => {
        const isCurrent = year === currentYear;
        const open = !!openYears[String(year)];
        return (
          <section key={year} className="space-y-2">
            <button onClick={() => toggleYear(year)} className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="font-black text-lg">{year}년 {isCurrent && <span className="text-xs text-blue-400 ml-1">올해</span>}</span>
              {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            {open && (
              <div className="space-y-2 pl-1">
                {yearEvents.map((event: any) => {
                  const repeated = getRecurrenceType(event) !== 'none';
                  return (
                    <button key={event.id} onClick={() => setEditingEvent(event)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition ${repeated ? 'bg-violet-500/10 border-violet-500/35' : 'bg-blue-500/5 border-slate-700/50 hover:border-blue-500/40'}`}>
                      <div className="w-20 shrink-0 text-xs font-bold text-slate-400">{format(event.start, 'yyyy.MM.dd')}</div>
                      <div className="w-14 shrink-0 text-xs font-bold text-slate-500">{format(event.start, 'HH:mm')}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {repeated && <Repeat className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                          {!!event.endDate && <CalendarRange className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                          <span className="font-bold truncate">{event.title}</span>
                        </div>
                        {event.location && <div className="text-[11px] text-slate-500 truncate mt-0.5">{event.location}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {editingEvent && <EventModal date={editingEvent.start} editingEvent={editingEvent} user={user} notify={onNotify} onClose={() => setEditingEvent(null)} onRefresh={onRefresh} />}
    </div>
  );
}
