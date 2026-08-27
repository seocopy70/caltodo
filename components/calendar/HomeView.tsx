'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { Plus, MapPin, Repeat, CalendarRange, StickyNote, Star, Trash2 } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import { api } from '../../lib/api-client';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import { getFolderColor } from '../../lib/folderColor';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
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

// 오늘 탭의 메모 카드: 별도 창을 띄우지 않고 카드 안에서 바로 수정. 내용 길이에 따라 카드 크기가 자연스럽게 늘어남.
// 카드 바깥을 탭해야 수정이 종료되도록 해서, 안쪽을 탭하거나 줄바꿈해도 실수로 닫히지 않게 함.
function TodayNoteCard({ note, onRefresh, onNotify }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const folderColor = note.folderId ? getFolderColor(note.folderId) : null;
  const iconColorClass = folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400';

  useEffect(() => { setTitle(note.title); setContent(note.content); }, [note.title, note.content]);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (editing) requestAnimationFrame(() => autoGrow(contentRef.current));
  }, [editing]);

  const persist = (extra?: any) => {
    const trimmedTitle = title.trim() || '(제목 없음)';
    if (!extra && trimmedTitle === note.title && content === note.content) return;
    api.notes.update(note.id, { title: trimmedTitle, content, showToday: note.showToday, folderId: note.folderId || null, format: note.format, ...extra })
      .then(() => onRefresh?.())
      .catch((err: any) => onNotify?.(`저장 실패: ${err.message || err}`, 'error'));
  };

  // 카드 바깥을 탭했을 때만 수정을 종료(+ 저장)하도록 함
  useEffect(() => {
    if (!editing) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        persist();
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, title, content]);

  const toggleStar = () => persist({ showToday: !note.showToday });
  const remove = () => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    api.notes.remove(note.id).then(() => { onNotify?.('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); }).catch((err: any) => onNotify?.(`삭제 실패: ${err.message || err}`, 'error'));
  };

  // 체크박스를 눌렀을 때는 체크만 토글하고, 수정모드로는 들어가지 않음
  const toggleLine = (idx: number) => {
    const newContent = toggleChecklistLine(content, idx);
    setContent(newContent);
    persist({ content: newContent });
  };
  // 글 내용(텍스트) 부분을 눌렀을 때만 수정모드로 진입
  const enterEditAtLine = () => setEditing(true);

  // 탭한 위치에 그대로 커서가 놓이도록, 보기/수정 모드에서 같은 textarea를 유지하고 readOnly만 바꿈
  // (일반 형식일 때만; 체크리스트/번호매김은 보기모드에서 예쁘게 렌더링하고, 탭하면 원문 편집 모드로 전환)
  const isPlain = (note.format || 'plain') === 'plain';

  return (
    <div ref={wrapperRef} className={`rounded-xl border p-4 transition ${editing ? 'border-amber-400/60 bg-white dark:bg-slate-900/40 shadow-sm' : 'border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 hover:bg-amber-100/60 dark:hover:bg-amber-500/10 cursor-text'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        {editing ? (
          <input
            autoFocus={!isPlain}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 min-w-0 bg-transparent font-bold text-base outline-none text-slate-900 dark:text-white"
          />
        ) : (
          <div onClick={() => setEditing(true)} className="flex-1 min-w-0 flex items-center gap-1.5 cursor-text">
            <StickyNote className={`w-4 h-4 shrink-0 ${iconColorClass}`} />
            <span className="font-bold text-base truncate text-slate-900 dark:text-white">{title}</span>
          </div>
        )}
        {editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button title={note.showToday ? '오늘 탭에서 숨기기' : '오늘 탭에 표시'} onClick={toggleStar} className={`p-1 ${note.showToday ? 'text-amber-400' : 'text-slate-400 dark:text-slate-600 hover:text-amber-400'}`}><Star className="w-3.5 h-3.5" fill={note.showToday ? 'currentColor' : 'none'} /></button>
            <button title="보관함으로 이동" onClick={remove} className="p-1 text-slate-400 dark:text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>

      {isPlain ? (
        <textarea
          ref={contentRef}
          value={content}
          readOnly={!editing}
          onClick={() => !editing && setEditing(true)}
          onChange={(e) => { setContent(e.target.value); autoGrow(e.target); }}
          onFocus={(e) => autoGrow(e.target)}
          rows={2}
          className={`w-full bg-transparent text-base leading-relaxed outline-none resize-none [overflow-wrap:anywhere] ${editing ? 'text-slate-700 dark:text-slate-300 cursor-text' : 'text-slate-600 dark:text-slate-400 cursor-text'}`}
        />
      ) : editing ? (
        <textarea
          ref={contentRef}
          autoFocus
          value={content}
          onChange={(e) => { setContent(e.target.value); autoGrow(e.target); }}
          onFocus={(e) => autoGrow(e.target)}
          rows={3}
          className="w-full bg-transparent text-base leading-relaxed outline-none resize-none [overflow-wrap:anywhere] text-slate-700 dark:text-slate-300"
        />
      ) : (
        <div className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {/* 체크박스는 토글만, 글자 부분을 눌러야 수정모드로 진입 (체크박스 클릭이 수정모드를 열지 않도록 분리) */}
          <NoteContent content={content} format={note.format} onToggleLine={toggleLine} onLineClick={enterEditAtLine} />
        </div>
      )}
    </div>
  );
}
