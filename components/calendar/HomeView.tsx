'use client';

import { useMemo, useState } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarPlus, MapPin, Repeat, CalendarRange } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import EventModal from './EventModal';
import TodoListPanel from './TodoListPanel';

export default function HomeView({ events, todos, user, onNotify, onRefresh }: any) {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const notify = onNotify || (() => {});

  const today = new Date();
  const tomorrow = addDays(today, 1);

  const dayGroups = useMemo(() => [today, tomorrow].map((day) => ({
    date: day,
    events: events
      .filter((e: any) => eventOccursOnDay(e, day))
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime()),
  })), [events]);

  return (
    <div className="max-w-5xl mx-auto space-y-5 p-2">
      <section className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <TodoListPanel todos={todos} user={user} onNotify={onNotify} onRefresh={onRefresh} maxVisible={5} compact />
        <button
          type="button"
          onClick={() => setIsEventModalOpen(true)}
          className="justify-self-end flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-bold text-sm"
          title="새 일정"
        >
          <CalendarPlus className="w-5 h-5" />
          <span className="hidden sm:inline">일정 추가</span>
        </button>
      </section>

      <div className="grid md:grid-cols-2 gap-5">
        {dayGroups.map((group) => (
          <section key={format(group.date, 'yyyy-MM-dd')} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
            <div className={`px-5 py-4 border-b border-slate-700/50 font-black ${isToday(group.date) ? 'text-blue-400' : 'text-violet-400'}`}>
              {format(group.date, 'M월 d일 (EEE)', { locale: ko })}
              {isToday(group.date) && <span className="ml-2 text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded">오늘</span>}
            </div>
            <div className="divide-y divide-slate-700/30">
              {group.events.map((event: any) => <EventRow key={event.id} event={event} onEdit={() => setEditingEvent(event)} />)}
              {group.events.length === 0 && <div className="text-center text-slate-600 py-8 text-sm">일정이 없습니다.</div>}
            </div>
          </section>
        ))}
      </div>

      {(isEventModalOpen || editingEvent) && (
        <EventModal
          date={new Date()}
          editingEvent={editingEvent}
          user={user}
          notify={notify}
          onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function EventRow({ event, onEdit }: any) {
  const repeated = getRecurrenceType(event) !== 'none';
  const multi = !!event.endDate;
  return (
    <div onClick={onEdit} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/20 transition ${repeated ? 'bg-violet-500/10' : ''}`}>
      <div className="w-12 text-[11px] font-bold text-slate-400">{format(event.start, 'HH:mm')}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {repeated && <Repeat className="w-3 h-3 text-violet-400" />}
          {multi && <CalendarRange className="w-3 h-3 text-slate-500" />}
          <span className="font-bold text-sm truncate">{event.title}</span>
        </div>
        {event.location && <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{event.location}</div>}
      </div>
    </div>
  );
}
