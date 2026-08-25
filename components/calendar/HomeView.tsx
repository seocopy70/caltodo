'use client';

import { useMemo, useState, useRef } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { Plus, MapPin, Repeat, CalendarRange, StickyNote } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import { api } from '../../lib/api-client';
import EventModal from './EventModal';
import TodoListPanel from './TodoListPanel';

const MIN_UPCOMING_EVENTS = 4;
const LOOKAHEAD_DAYS = 30; // 오늘낼 일정이 4개 안 되면 최대 이만큼 앞으로 훑어서 채움

export default function HomeView({ events, todos, notes = [], user, onNotify, onRefresh, onPatchTodo, onRemoveTodo, onNewNote, onEditNote }: any) {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const notify = onNotify || (() => {});
  const today = new Date();

  const combinedEvents = useMemo(() => {
    const result: any[] = [];
    for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
      const day = addDays(today, i);
      const dayEvents = events
        .filter((e: any) => eventOccursOnDay(e, day))
        .map((e: any) => ({ ...e, __day: day }))
        .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
      result.push(...dayEvents);
      // 오늘+내일(i=0,1)은 항상 포함하고, 그 이후는 4개를 채울 때까지만 순차적으로 추가
      if (i >= 1 && result.length >= MIN_UPCOMING_EVENTS) break;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  return <div className="max-w-5xl mx-auto space-y-5 p-2">
    <TodoListPanel todos={todos} user={user} onNotify={onNotify} onRefresh={onRefresh} onPatchTodo={onPatchTodo} onRemoveTodo={onRemoveTodo} maxVisible={5} compact hideCompleted largePlaceholder />

    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setIsEventModalOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-bold text-sm" title="새 일정"><Plus className="w-5 h-5" /><span>새 일정</span></button>
      <button type="button" onClick={() => onNewNote?.()} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition font-bold text-sm" title="새 메모"><Plus className="w-5 h-5" /><span>새 메모</span></button>
    </div>

    <section className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 overflow-hidden">
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
        {combinedEvents.map((event: any) => <EventRow key={`${event.id}-${format(event.__day, 'yyyy-MM-dd')}`} event={event} onEdit={() => setEditingEvent(event)} />)}
        {combinedEvents.length === 0 && <div className="text-center text-slate-500 dark:text-slate-600 py-8 text-sm">일정이 없습니다.</div>}
      </div>
    </section>

    {notes.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {notes.map((note: any) => <TodayNoteCard key={note.id} note={note} onRefresh={onRefresh} onNotify={notify} />)}
      </div>
    )}

    {(isEventModalOpen || editingEvent) && <EventModal date={new Date()} editingEvent={editingEvent} user={user} notify={notify} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} onRefresh={onRefresh} />}
  </div>;
}

function EventRow({ event, onEdit }: any) {
  const repeated = getRecurrenceType(event) !== 'none';
  const multi = !!event.endDate;
  return <div onClick={onEdit} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition ${repeated ? 'bg-violet-50 dark:bg-violet-500/10' : ''}`}>
    <div className="w-16 shrink-0 text-sm font-bold text-slate-500 dark:text-slate-400">{isToday(event.__day) ? '오늘' : format(event.__day, 'M/d')} {format(event.start, 'HH:mm')}</div>
    <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5">{repeated && <Repeat className="w-3 h-3 text-violet-400" />}{multi && <CalendarRange className="w-3 h-3 text-slate-500" />}<span className="font-bold text-sm truncate">{event.title}</span></div>{event.location && <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{event.location}</div>}</div>
  </div>;
}

// 오늘 탭의 메모 카드: 별도 창을 띄우지 않고 카드 안에서 바로 수정. 내용 길이에 따라 textarea 높이가 자동으로 늘어남.
function TodayNoteCard({ note, onRefresh, onNotify }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const save = () => {
    setEditing(false);
    const trimmedTitle = title.trim() || '(제목 없음)';
    if (trimmedTitle === note.title && content === note.content) return;
    api.notes.update(note.id, { title: trimmedTitle, content, showToday: note.showToday })
      .then(() => onRefresh?.())
      .catch((err: any) => onNotify?.(`저장 실패: ${err.message || err}`, 'error'));
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-amber-400/50 bg-white dark:bg-slate-900/40 p-4 shadow-sm">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          className="w-full bg-transparent font-bold text-base outline-none mb-1.5 text-slate-900 dark:text-white"
        />
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); autoGrow(e.target); }}
          onFocus={(e) => autoGrow(e.target)}
          onBlur={save}
          rows={3}
          className="w-full bg-transparent text-sm leading-relaxed outline-none resize-none text-slate-700 dark:text-slate-300"
        />
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 hover:bg-amber-100/60 dark:hover:bg-amber-500/10 transition p-4">
      <div className="flex items-center gap-1.5 mb-1"><StickyNote className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" /><span className="font-bold text-base truncate text-slate-900 dark:text-white">{note.title}</span></div>
      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed whitespace-pre-wrap">{note.content}</p>
    </button>
  );
}
