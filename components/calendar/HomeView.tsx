'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Plus, MapPin, AlignLeft, StickyNote, Star, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import { api } from '../../lib/api-client';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import { getFolderColor } from '../../lib/folderColor';
import EventModal from './EventModal';
import TodoModal from './TodoModal';
import TodoListPanel from './TodoListPanel';

const EXPANDED_WINDOW_DAYS = 7; // 펼치면 오늘부터 7일 이내 일정까지 가까운 순서로 모두 표시

export default function HomeView({ events, todos, notes = [], todoFolders = [], noteFolders = [], user, onNotify, onRefresh, onPatchTodo, onRemoveTodo, onPatchNote, onNewNote, onEditNote }: any) {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isNewTodoOpen, setIsNewTodoOpen] = useState(false);
  // 할일 목록과 일정 중 하나를 펼치면 다른 하나는 자동으로 접히도록 펼침 상태를 하나로 관리
  const [expandedSection, setExpandedSection] = useState<'todos' | 'events' | null>(null);
  const todosExpanded = expandedSection === 'todos';
  const eventsExpanded = expandedSection === 'events';
  const setEventsExpanded = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? (v as (prev: boolean) => boolean)(eventsExpanded) : v;
    setExpandedSection(next ? 'events' : null);
  };
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

  // 접으면 "지금 시각" 기준으로 지난 일정은 제외하고 가장 가까운 3개만, 펼치면 7일 내 전체(가까운 순서)
  const collapsedEvents = useMemo(() => {
    const now = new Date();
    return windowEvents.filter((e: any) => e.start.getTime() >= now.getTime()).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEvents]);
  const visibleEvents = eventsExpanded ? windowEvents : collapsedEvents;

  return <div className="max-w-5xl mx-auto space-y-4 p-2">
    {/* 새 할일/일정/메모 — 화면 맨 위, 자주 쓰는 순서(할일 먼저) */}
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setIsNewTodoOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition font-bold text-sm" title="새 할일"><Plus className="w-5 h-5" /><span>새 할일</span></button>
      <button type="button" onClick={() => setIsEventModalOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-bold text-sm" title="새 일정"><Plus className="w-5 h-5" /><span>새 일정</span></button>
      <button type="button" onClick={() => onNewNote?.()} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition font-bold text-sm" title="새 메모"><Plus className="w-5 h-5" /><span>새 메모</span></button>
    </div>

    <TodoListPanel
      todos={todos}
      folders={todoFolders}
      user={user}
      onNotify={onNotify}
      onRefresh={onRefresh}
      onPatchTodo={onPatchTodo}
      onRemoveTodo={onRemoveTodo}
      maxVisible={5}
      compact
      hideCompleted
      largePlaceholder
      showRelativeDates
      expanded={todosExpanded}
      onExpandedChange={(v: boolean) => setExpandedSection(v ? 'todos' : null)}
    />

    <section className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 overflow-hidden">
      {windowEvents.length > collapsedEvents.length && (
        <button onClick={() => setEventsExpanded((v) => !v)} title={eventsExpanded ? '접기' : `펼치기 (7일 내 ${windowEvents.length}개)`} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-700/40 text-xs font-bold text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
          {!eventsExpanded && <span>{`7일 내 ${windowEvents.length}개`}</span>}
          {eventsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}
      <div className={`divide-y divide-slate-100 dark:divide-slate-700/30 ${eventsExpanded ? 'max-h-[50vh] overflow-y-auto' : ''}`}>
        {visibleEvents.map((event: any) => <EventRow key={`${event.id}-${format(event.__day, 'yyyy-MM-dd')}`} event={event} onEdit={() => setEditingEvent(event)} />)}
        {windowEvents.length === 0 && <div className="text-center text-slate-500 dark:text-slate-600 py-8 text-sm">일정이 없습니다.</div>}
      </div>
    </section>

    {notes.length > 0 && (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 items-start">
        {notes.map((note: any) => <TodayNoteCard key={note.id} note={note} noteFolders={noteFolders} onRefresh={onRefresh} onNotify={notify} onEditNote={onEditNote} onPatchNote={onPatchNote} />)}
      </div>
    )}

    {(isEventModalOpen || editingEvent) && <EventModal date={new Date()} editingEvent={editingEvent} user={user} notify={notify} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} onRefresh={onRefresh} />}
    {isNewTodoOpen && <TodoModal todo={null} folders={todoFolders} notify={notify} onClose={() => setIsNewTodoOpen(false)} onRefresh={onRefresh} />}
  </div>;
}

function EventRow({ event, onEdit }: any) {
  const repeated = getRecurrenceType(event) !== 'none';
  const today = new Date();
  const diffDays = Math.round((new Date(event.__day.getFullYear(), event.__day.getMonth(), event.__day.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  const dayLabel = diffDays === 0 ? '오늘' : diffDays === 1 ? '내일' : format(event.__day, 'M/d');
  return <div onClick={onEdit} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition ${repeated ? 'bg-violet-50 dark:bg-violet-500/10' : ''}`}>
    {/* 날짜/시간을 두 줄로 통일 */}
    <div className="w-14 shrink-0 flex flex-col items-start leading-tight">
      <span className={`text-sm font-black ${diffDays <= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{dayLabel}</span>
      <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{format(event.start, 'HH:mm')}</span>
    </div>
    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 min-w-0"><span className="font-bold text-sm truncate">{event.title}</span></div>
      {event.location ? <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" />{event.location}</span> : event.description ? <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 truncate"><AlignLeft className="w-3.5 h-3.5 shrink-0" />{event.description}</span> : null}
    </div>
  </div>;
}

// 오늘 탭의 메모 카드: 별도 창을 띄우지 않고 카드 안에서 바로 수정. 내용은 10줄까지 보여주고 넘치면 카드 내부에서만 스크롤.
// 카드 바깥을 탭해야 수정이 종료되도록 해서, 안쪽을 탭하거나 줄바꿈해도 실수로 닫히지 않게 함.
const NOTE_CARD_CONTENT_MAX_HEIGHT = 260; // text-base leading-relaxed 기준 대략 10줄

// 오늘 탭의 메모 카드: 카드 자체에서 제목/본문을 고쳐쓰지 않고, 탭하면 전체 메모 수정창(모달)을 띄움.
// 체크리스트 체크박스만은 예외적으로 카드에서 바로 토글(빠른 확인/체크 용도).
function TodayNoteCard({ note, noteFolders = [], onRefresh, onNotify, onEditNote, onPatchNote }: any) {
  const [content, setContent] = useState(note.content);
  // 체크박스를 연달아 빠르게 누를 때 React 렌더 타이밍에 의존하지 않고 항상 "가장 최신" content를 기준으로
  // 다음 토글을 계산하기 위한 ref (state만 쓰면 연속 탭 시 이전 토글이 유실되는 경우가 있었음)
  const latestContentRef = useRef(content);
  const folderColor = note.folderId ? getFolderColor(note.folderId, noteFolders) : null;
  const iconColorClass = folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400';

  useEffect(() => { setContent(note.content); latestContentRef.current = note.content; }, [note.content]);

  // 이미 화면(부모 state)에 낙관적으로 반영해둔 뒤 서버에 저장만 하므로, 매번 전체 재조회(onRefresh)를
  // 다시 돌릴 필요가 없음 — 실패했을 때만 재조회해서 실제 서버 상태로 되돌린다.
  const toggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPatchNote?.(note.id, { showToday: !note.showToday });
    api.notes.update(note.id, { title: note.title, content: note.content, showToday: !note.showToday, folderId: note.folderId || null, format: note.format })
      .catch((err: any) => { onNotify?.(`저장 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };
  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    onPatchNote?.(note.id, { deletedAt: new Date() });
    api.notes.remove(note.id)
      .then(() => onNotify?.('메모를 보관함으로 옮겼습니다.'))
      .catch((err: any) => { onNotify?.(`삭제 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  // 체크박스를 눌렀을 때는 체크만 토글하고, 수정창은 열지 않음.
  // latestContentRef를 기준으로 계산해서, 빠르게 연달아 누를 때 이전 토글이 유실되지 않게 함.
  const toggleLine = (idx: number) => {
    const newContent = toggleChecklistLine(latestContentRef.current, idx);
    latestContentRef.current = newContent;
    setContent(newContent);
    onPatchNote?.(note.id, { content: newContent });
    api.notes.update(note.id, { title: note.title, content: newContent, showToday: note.showToday, folderId: note.folderId || null, format: note.format })
      .catch((err: any) => { onNotify?.(`저장 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  return (
    <div onClick={() => onEditNote?.(note)} className="rounded-xl border p-4 transition border-slate-200 dark:border-slate-700/30 bg-white dark:bg-slate-800/30 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm dark:shadow-none cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <StickyNote className={`w-4 h-4 shrink-0 ${iconColorClass}`} />
          <span className="font-bold text-base truncate text-slate-900 dark:text-white">{note.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button title={note.showToday ? '오늘 탭에서 숨기기' : '오늘 탭에 표시'} onClick={toggleStar} className={`p-1 ${note.showToday ? 'text-amber-400' : 'text-slate-400 dark:text-slate-600 hover:text-amber-400'}`}><Star className="w-3.5 h-3.5" fill={note.showToday ? 'currentColor' : 'none'} /></button>
          <button title="보관함으로 이동" onClick={remove} className="p-1 text-slate-400 dark:text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="text-base text-slate-600 dark:text-slate-400 leading-relaxed overflow-y-auto [overflow-wrap:anywhere]" style={{ maxHeight: NOTE_CARD_CONTENT_MAX_HEIGHT }} onClick={(e) => e.stopPropagation()}>
        {/* 체크박스는 토글만, 글자 부분을 눌러야 수정창이 열림(onLineClick) */}
        <NoteContent content={content} format={note.format} onToggleLine={toggleLine} onLineClick={(idx: number, charOffset?: number) => onEditNote?.(note, 'content', idx, charOffset)} />
      </div>
    </div>
  );
}
