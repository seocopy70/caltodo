'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Plus, MapPin, AlignLeft, Repeat, CalendarRange, StickyNote, Star, Trash2 } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import { api } from '../../lib/api-client';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import { getFolderColor } from '../../lib/folderColor';
import EventModal from './EventModal';
import TodoModal from './TodoModal';
import TodoListPanel from './TodoListPanel';

const EXPANDED_WINDOW_DAYS = 7; // 펼치면 오늘부터 7일 이내 일정까지 가까운 순서로 모두 표시

export default function HomeView({ events, todos, notes = [], todoFolders = [], user, onNotify, onRefresh, onPatchTodo, onRemoveTodo, onNewNote, onEditNote }: any) {
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isNewTodoOpen, setIsNewTodoOpen] = useState(false);
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

  // 접으면 오늘·내일 일정만, 펼치면 7일 내 전체(가까운 순서)
  const collapsedEvents = useMemo(() => windowEvents.filter((e: any) => {
    const diff = Math.round((e.__day.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
    return diff <= 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [windowEvents]);
  const visibleEvents = eventsExpanded ? windowEvents : collapsedEvents;

  return <div className="max-w-5xl mx-auto space-y-4 p-2">
    {/* 새 할일/일정/메모 — 화면 맨 위, 자주 쓰는 순서(할일 먼저) */}
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setIsNewTodoOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition font-bold text-sm" title="새 할일"><Plus className="w-5 h-5" /><span>새 할일</span></button>
      <button type="button" onClick={() => setIsEventModalOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-bold text-sm" title="새 일정"><Plus className="w-5 h-5" /><span>새 일정</span></button>
      <button type="button" onClick={() => onNewNote?.()} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition font-bold text-sm" title="새 메모"><Plus className="w-5 h-5" /><span>새 메모</span></button>
    </div>

    <TodoListPanel todos={todos} folders={todoFolders} user={user} onNotify={onNotify} onRefresh={onRefresh} onPatchTodo={onPatchTodo} onRemoveTodo={onRemoveTodo} maxVisible={5} compact hideCompleted largePlaceholder showRelativeDates />

    <section className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 overflow-hidden">
      {windowEvents.length > collapsedEvents.length && (
        <button onClick={() => setEventsExpanded((v) => !v)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-700/40 text-xs font-bold text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
          {eventsExpanded ? '접기' : `펼치기 (7일 내 ${windowEvents.length}개)`}
        </button>
      )}
      <div className={`divide-y divide-slate-100 dark:divide-slate-700/30 ${eventsExpanded ? 'max-h-[50vh] overflow-y-auto' : ''}`}>
        {visibleEvents.map((event: any) => <EventRow key={`${event.id}-${format(event.__day, 'yyyy-MM-dd')}`} event={event} onEdit={() => setEditingEvent(event)} />)}
        {windowEvents.length === 0 && <div className="text-center text-slate-500 dark:text-slate-600 py-8 text-sm">일정이 없습니다.</div>}
      </div>
    </section>

    {notes.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {notes.map((note: any) => <TodayNoteCard key={note.id} note={note} onRefresh={onRefresh} onNotify={notify} />)}
      </div>
    )}

    {(isEventModalOpen || editingEvent) && <EventModal date={new Date()} editingEvent={editingEvent} user={user} notify={notify} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} onRefresh={onRefresh} />}
    {isNewTodoOpen && <TodoModal todo={null} folders={todoFolders} notify={notify} onClose={() => setIsNewTodoOpen(false)} onRefresh={onRefresh} />}
  </div>;
}

function EventRow({ event, onEdit }: any) {
  const repeated = getRecurrenceType(event) !== 'none';
  const multi = !!event.endDate;
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
      <div className="flex items-center gap-1.5 min-w-0">{repeated && <Repeat className="w-3 h-3 text-violet-400 shrink-0" />}{multi && <CalendarRange className="w-3 h-3 text-slate-500 shrink-0" />}<span className="font-bold text-sm truncate">{event.title}</span></div>
      {event.location ? <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" />{event.location}</span> : event.description ? <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 truncate"><AlignLeft className="w-3.5 h-3.5 shrink-0" />{event.description}</span> : null}
    </div>
  </div>;
}

// 오늘 탭의 메모 카드: 별도 창을 띄우지 않고 카드 안에서 바로 수정. 내용은 10줄까지 보여주고 넘치면 카드 내부에서만 스크롤.
// 카드 바깥을 탭해야 수정이 종료되도록 해서, 안쪽을 탭하거나 줄바꿈해도 실수로 닫히지 않게 함.
const NOTE_CARD_CONTENT_MAX_HEIGHT = 260; // text-base leading-relaxed 기준 대략 10줄

function TodayNoteCard({ note, onRefresh, onNotify }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 체크박스를 연달아 빠르게 누를 때 React 렌더 타이밍에 의존하지 않고 항상 "가장 최신" content를 기준으로
  // 다음 토글을 계산하기 위한 ref (state만 쓰면 연속 탭 시 이전 토글이 유실되는 경우가 있었음)
  const latestContentRef = useRef(content);
  // 카드 바깥을 탭해 수정을 닫은 직후, 같은 탭 동작이 이어서 발생시키는 click까지 삼켜서
  // 탭한 다른 항목(일정/할일 카드 등)이 실수로 열리지 않도록 함
  const suppressNextClickRef = useRef(false);
  const folderColor = note.folderId ? getFolderColor(note.folderId) : null;
  const iconColorClass = folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400';

  useEffect(() => { setTitle(note.title); setContent(note.content); latestContentRef.current = note.content; }, [note.title, note.content]);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  // editing 상태와 무관하게 content가 바뀔 때마다(체크박스 토글, 최초 로드 등) 항상 다시 계산해서,
  // 특정 트리거(포커스/입력)에서만 높이가 갱신되어 카드가 짧게/길게 들쭉날쭉해 보이던 문제를 없앰.
  // 실제 표시 높이는 아래 CSS max-height로 10줄에서 캡되고 그 이상은 내부 스크롤됨.
  useEffect(() => {
    requestAnimationFrame(() => autoGrow(contentRef.current));
  }, [editing, content]);

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
        suppressNextClickRef.current = true;
      }
    };
    // capture 단계에서 먼저 잡아서, 바깥 탭이 이어서 만드는 click이 탭 대상 요소(일정/할일 항목 등)의
    // 자체 onClick으로 전달되기 전에 삼킨다.
    const handleClickCapture = (e: MouseEvent) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('click', handleClickCapture, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('click', handleClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, title, content]);

  const toggleStar = () => persist({ showToday: !note.showToday });
  const remove = () => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    api.notes.remove(note.id).then(() => { onNotify?.('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); }).catch((err: any) => onNotify?.(`삭제 실패: ${err.message || err}`, 'error'));
  };

  // 체크박스를 눌렀을 때는 체크만 토글하고, 수정모드로는 들어가지 않음.
  // latestContentRef를 기준으로 계산해서, 빠르게 연달아 누를 때 이전 토글이 유실되지 않게 함.
  const toggleLine = (idx: number) => {
    const newContent = toggleChecklistLine(latestContentRef.current, idx);
    latestContentRef.current = newContent;
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
          onChange={(e) => { setContent(e.target.value); latestContentRef.current = e.target.value; autoGrow(e.target); }}
          onFocus={(e) => autoGrow(e.target)}
          rows={2}
          style={{ maxHeight: NOTE_CARD_CONTENT_MAX_HEIGHT }}
          className={`w-full bg-transparent text-base leading-relaxed outline-none resize-none overflow-y-auto [overflow-wrap:anywhere] ${editing ? 'text-slate-700 dark:text-slate-300 cursor-text' : 'text-slate-600 dark:text-slate-400 cursor-text'}`}
        />
      ) : editing ? (
        <textarea
          ref={contentRef}
          autoFocus
          value={content}
          onChange={(e) => { setContent(e.target.value); latestContentRef.current = e.target.value; autoGrow(e.target); }}
          onFocus={(e) => autoGrow(e.target)}
          rows={3}
          style={{ maxHeight: NOTE_CARD_CONTENT_MAX_HEIGHT }}
          className="w-full bg-transparent text-base leading-relaxed outline-none resize-none overflow-y-auto [overflow-wrap:anywhere] text-slate-700 dark:text-slate-300"
        />
      ) : (
        <div className="text-base text-slate-600 dark:text-slate-400 leading-relaxed overflow-y-auto" style={{ maxHeight: NOTE_CARD_CONTENT_MAX_HEIGHT }}>
          {/* 체크박스는 토글만, 글자 부분을 눌러야 수정모드로 진입 (체크박스 클릭이 수정모드를 열지 않도록 분리) */}
          <NoteContent content={content} format={note.format} onToggleLine={toggleLine} onLineClick={enterEditAtLine} />
        </div>
      )}
    </div>
  );
}
