'use client';

import { useMemo, useState } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { CalendarPlus, MapPin, Repeat, CalendarRange, StickyNote, NotebookPen } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import { api } from '../../lib/api-client';
import EventModal from './EventModal';
import TodoListPanel from './TodoListPanel';

export default function HomeView({ events, todos, notes = [], user, onNotify, onRefresh }: any) {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const notify = onNotify || (() => {});
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const combinedEvents = useMemo(() => {
    return [today, tomorrow]
      .flatMap((day) => events.filter((e: any) => eventOccursOnDay(e, day)).map((e: any) => ({ ...e, __day: day })))
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const addNewNote = () => {
    api.notes.create({ title: '새 메모', content: '', showToday: true })
      .then(() => { notify('메모가 추가되었습니다.'); onRefresh?.(); })
      .catch((err: any) => notify(`추가 실패: ${err.message || err}`, 'error'));
  };

  return <div className="max-w-5xl mx-auto space-y-5 p-2">
    <TodoListPanel todos={todos} user={user} onNotify={onNotify} onRefresh={onRefresh} maxVisible={5} compact />

    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setIsEventModalOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-bold text-sm" title="새 일정"><CalendarPlus className="w-5 h-5" /><span className="hidden sm:inline">새 일정</span></button>
      <button type="button" onClick={addNewNote} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition font-bold text-sm" title="새 메모"><NotebookPen className="w-5 h-5" /><span className="hidden sm:inline">새 메모</span></button>
    </div>

    <section className="rounded-2xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50 font-black text-blue-400">오늘낼 일정</div>
      <div className="divide-y divide-slate-700/30">
        {combinedEvents.map((event: any) => <EventRow key={`${event.id}-${format(event.__day, 'yyyy-MM-dd')}`} event={event} onEdit={() => setEditingEvent(event)} />)}
        {combinedEvents.length === 0 && <div className="text-center text-slate-600 py-8 text-sm">일정이 없습니다.</div>}
      </div>
    </section>

    {notes.length > 0 && <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden divide-y divide-amber-500/10">
      {notes.map((note: any) => <InlineNote key={note.id} note={note} onRefresh={onRefresh} onNotify={onNotify} />)}
    </section>}

    {(isEventModalOpen || editingEvent) && <EventModal date={new Date()} editingEvent={editingEvent} user={user} notify={notify} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} onRefresh={onRefresh} />}
  </div>;
}

function EventRow({ event, onEdit }: any) {
  const repeated = getRecurrenceType(event) !== 'none';
  const multi = !!event.endDate;
  return <div onClick={onEdit} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/20 transition ${repeated ? 'bg-violet-500/10' : ''}`}>
    <div className="w-14 shrink-0 text-[11px] font-bold text-slate-400">{isToday(event.__day) ? '오늘' : '내일'} {format(event.start, 'HH:mm')}</div>
    <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5">{repeated && <Repeat className="w-3 h-3 text-violet-400" />}{multi && <CalendarRange className="w-3 h-3 text-slate-500" />}<span className="font-bold text-sm truncate">{event.title}</span></div>{event.location && <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{event.location}</div>}</div>
  </div>;
}

function InlineNote({ note, onRefresh, onNotify }: any) {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const notify = onNotify || (() => {});

  const save = () => {
    if (title === note.title && content === note.content) return;
    api.notes.update(note.id, { title: title.trim() || '(제목 없음)', content, showToday: note.showToday })
      .then(() => onRefresh?.())
      .catch((err: any) => notify(`저장 실패: ${err.message || err}`, 'error'));
  };

  return <div className="px-5 py-4">
    <div className="flex items-center gap-1.5 mb-1.5"><StickyNote className="w-4 h-4 text-amber-400 shrink-0" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} className="flex-1 bg-transparent outline-none font-bold text-base" />
    </div>
    <textarea value={content} onChange={(e) => setContent(e.target.value)} onBlur={save} rows={3} className="w-full bg-transparent outline-none text-base text-slate-300 resize-none leading-relaxed" placeholder="내용을 입력하세요..." />
  </div>;
}
