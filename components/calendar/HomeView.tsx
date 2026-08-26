'use client';

import { useMemo, useState, useRef } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { Plus, MapPin, Repeat, CalendarRange, StickyNote, Lock } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import { api } from '../../lib/api-client';
import { hashCode } from '../../lib/noteLock';
import { PinInput, PatternInput } from './NoteLockPad';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import EventModal from './EventModal';
import TodoListPanel from './TodoListPanel';

const DEFAULT_VISIBLE = 3;
const EXPANDED_WINDOW_DAYS = 5; // 펼치면 오늘부터 5일 이내 일정까지 모두 표시

export default function HomeView({ events, todos, notes = [], user, onNotify, onRefresh, onPatchTodo, onRemoveTodo, onNewNote, onEditNote }: any) {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const notify = onNotify || (() => {});
  const today = new Date();

  const windowEvents = useMemo(() => {
    const result: any[] = [];
    for (let i = 0; i < EXPANDED_WINDOW_DAYS; i++) {
      const day = addDays(today, i);
      const dayEvents = events
        .filter((e: any) => eventOccursOnDay(e, day))
        .map((e: any) => ({ ...e, __day: day }))
        .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
      result.push(...dayEvents);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const visibleEvents = eventsExpanded ? windowEvents : windowEvents.slice(0, DEFAULT_VISIBLE);

  return <div className="max-w-5xl mx-auto space-y-4 p-2">
    <TodoListPanel todos={todos} user={user} onNotify={onNotify} onRefresh={onRefresh} onPatchTodo={onPatchTodo} onRemoveTodo={onRemoveTodo} maxVisible={5} compact hideCompleted largePlaceholder />

    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setIsEventModalOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-bold text-sm" title="새 일정"><Plus className="w-5 h-5" /><span>새 일정</span></button>
      <button type="button" onClick={() => onNewNote?.()} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition font-bold text-sm" title="새 메모"><Plus className="w-5 h-5" /><span>새 메모</span></button>
    </div>

    <section className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 overflow-hidden">
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
        {visibleEvents.map((event: any) => <EventRow key={`${event.id}-${format(event.__day, 'yyyy-MM-dd')}`} event={event} onEdit={() => setEditingEvent(event)} />)}
        {windowEvents.length === 0 && <div className="text-center text-slate-500 dark:text-slate-600 py-8 text-sm">일정이 없습니다.</div>}
      </div>
      {windowEvents.length > DEFAULT_VISIBLE && (
        <button onClick={() => setEventsExpanded((v) => !v)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-slate-100 dark:border-slate-700/40 text-xs font-bold text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
          {eventsExpanded ? '접기' : `펼치기 (5일 내 ${windowEvents.length}개)`}
        </button>
      )}
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
  return <div onClick={onEdit} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition ${repeated ? 'bg-violet-50 dark:bg-violet-500/10' : ''}`}>
    {/* 날짜/시간을 두 줄로 통일 */}
    <div className="w-14 shrink-0 flex flex-col items-start leading-tight">
      <span className="text-sm font-black text-slate-700 dark:text-slate-300">{isToday(event.__day) ? '오늘' : format(event.__day, 'M/d')}</span>
      <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{format(event.start, 'HH:mm')}</span>
    </div>
    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 min-w-0">{repeated && <Repeat className="w-3 h-3 text-violet-400 shrink-0" />}{multi && <CalendarRange className="w-3 h-3 text-slate-500 shrink-0" />}<span className="font-bold text-sm truncate">{event.title}</span></div>
      {event.location && <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" />{event.location}</span>}
    </div>
  </div>;
}

// 오늘 탭의 메모 카드: 별도 창을 띄우지 않고 카드 안에서 바로 수정. 내용 길이에 따라 textarea 높이가 자동으로 늘어남.
function TodayNoteCard({ note, onRefresh, onNotify }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const isLocked = !!note.locked && !unlocked;

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

  const toggleLine = (idx: number) => {
    const newContent = toggleChecklistLine(content, idx);
    setContent(newContent);
    api.notes.update(note.id, { title: note.title, content: newContent, showToday: note.showToday, format: note.format, locked: note.locked, lockType: note.lockType, lockHash: note.lockHash })
      .then(() => onRefresh?.());
  };

  const tryUnlock = async (code: string) => {
    const hash = await hashCode(code);
    if (hash === note.lockHash) { setUnlocked(true); setUnlockError(false); }
    else setUnlockError(true);
  };

  if (isLocked) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 p-4 space-y-2">
        <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-slate-400 shrink-0" /><span className="font-bold text-base text-slate-500 dark:text-slate-400">비밀 메모</span></div>
        <div className="max-w-[220px]">
          {note.lockType === 'pattern' ? <PatternInput onSubmit={tryUnlock} submitLabel="해제" /> : <PinInput onSubmit={tryUnlock} submitLabel="해제" />}
        </div>
        {unlockError && <p className="text-xs text-rose-500">맞지 않아요.</p>}
      </div>
    );
  }

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
      <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed">
        <NoteContent content={note.content} format={note.format} onToggleLine={toggleLine} />
      </div>
    </button>
  );
}
