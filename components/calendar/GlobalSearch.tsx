'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, CheckSquare, FileText, X, Trash2 } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { api } from '../../lib/api-client';
import { expandOccurrences } from '../../lib/recurrence';

type Category = 'all' | 'events' | 'todos' | 'notes';

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(query);
  let key = 0;
  while (index !== -1) {
    if (index > cursor) parts.push(<span key={`t-${key++}`}>{text.slice(cursor, index)}</span>);
    parts.push(<mark key={`m-${key++}`} className="bg-amber-200 dark:bg-amber-500/40 text-inherit rounded px-0.5">{text.slice(index, index + query.length)}</mark>);
    cursor = index + query.length;
    index = lower.indexOf(query, cursor);
  }
  if (cursor < text.length) parts.push(<span key={`t-${key++}`}>{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

function noteContentSnippet(content: string, query: string) {
  const lines = (content || '').split(/\r?\n/);
  if (!query) return lines.slice(0, 3).join('\n');
  const lowerQuery = query.toLowerCase();
  const matchLine = lines.findIndex((line) => line.toLowerCase().includes(lowerQuery));
  if (matchLine < 0) return lines.slice(0, 3).join('\n');
  const start = Math.max(0, matchLine - 1);
  const end = Math.min(lines.length, start + 3);
  const adjustedStart = Math.min(start, Math.max(0, end - 3));
  return lines.slice(adjustedStart, end).join('\n');
}

function noteMatchInfo(note: any, query: string) {
  const title = String(note.title || '');
  const content = String(note.content || '');
  const folderName = String(note.folderName || '');
  const lowerQuery = query.toLowerCase();
  const titleMatch = !!query && title.toLowerCase().includes(lowerQuery);
  const contentIndex = query ? content.toLowerCase().indexOf(lowerQuery) : -1;
  const folderMatch = !!query && folderName.toLowerCase().includes(lowerQuery);
  if (titleMatch) return { matchType: 'title' as const, lineIndex: undefined, charOffset: undefined };
  if (contentIndex >= 0) {
    const before = content.slice(0, contentIndex);
    const lineIndex = before.split(/\r?\n/).length - 1;
    const lineStart = before.lastIndexOf('\n') + 1;
    let charOffset = contentIndex - lineStart;
    if (note.format === 'checklist') {
      const line = content.split(/\r?\n/)[lineIndex] || '';
      const prefix = line.match(/^\[( |x)\]\s?/i)?.[0]?.length || 0;
      charOffset = Math.max(0, charOffset - prefix);
    }
    return { matchType: 'content' as const, lineIndex, charOffset };
  }
  if (folderMatch) return { matchType: 'folder' as const, lineIndex: undefined, charOffset: undefined };
  return { matchType: 'none' as const, lineIndex: undefined, charOffset: undefined };
}

export default function GlobalSearch({ query, date, dateEnd, events, todos, notes, folders = [], onClose, onEvent, onTodo, onNote, onRefresh, onNotify, pushDownBy }: any) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<Category>('all');
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const [resultLeft, setResultLeft] = useState<number | null>(null);
  const lastViewportWidthRef = useRef<number | null>(null);

  const q = (query || '').trim().toLowerCase();

  useLayoutEffect(() => {
    const panel = resultPanelRef.current;
    const anchor = panel?.parentElement;
    if (!panel || !anchor) return;
    const updatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const panelWidth = panelRect.width;
      const margin = viewportWidth >= 768 ? 100 : 8;
      // 검색결과창은 입력창 위치를 기준으로 붙이지 않고 현재 layout viewport 중앙에 배치한다.
      // window.innerWidth와 100vw를 섞어 계산하면 모바일 키보드가 처음 나타날 때
      // visual/layout viewport 변화로 가로 위치가 순간적으로 틀어질 수 있으므로
      // CSS layout viewport와 같은 documentElement.clientWidth를 기준으로 계산한다.
      const targetLeft = (viewportWidth - panelWidth) / 2;
      const minLeft = margin - anchorRect.left;
      const maxLeft = viewportWidth - margin - panelWidth - anchorRect.left;
      setResultLeft(Math.min(maxLeft, Math.max(minLeft, targetLeft - anchorRect.left)));
    };
    updatePosition();
    lastViewportWidthRef.current = document.documentElement.clientWidth;
    const handleResize = () => {
      // 모바일 키보드가 열리고 닫힐 때는 보통 높이만 변한다.
      // 가로 폭이 그대로인데 위치를 다시 계산하면 wide-phone에서
      // 첫 키보드 표시 순간 검색결과창의 가로 위치가 튀는 문제가 생길 수 있다.
      const nextWidth = document.documentElement.clientWidth;
      if (lastViewportWidthRef.current === nextWidth) return;
      lastViewportWidthRef.current = nextWidth;
      updatePosition();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [query, date, dateEnd, category, events, todos, notes]);
  const notify = onNotify || (() => {});

  const rangeStart = date ? startOfDay(date) : null;
  const rangeEnd = date ? startOfDay(dateEnd && dateEnd.getTime() >= date.getTime() ? dateEnd : date) : null;
  const isRange = !!(rangeStart && rangeEnd && rangeStart.getTime() !== rangeEnd.getTime());
  const isDateSearch = !!(rangeStart && rangeEnd);
  const inDateRange = (d: Date | null | undefined) => {
    if (!d || !rangeStart || !rangeEnd) return false;
    const t = startOfDay(d).getTime();
    return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
  };

  const secureFolderId = useMemo(() => folders.find((f: any) => f.isSecure)?.id || null, [folders]);
  const folderNameById = useMemo(() => Object.fromEntries(folders.map((f: any) => [f.id, f.name])), [folders]);

  const results = useMemo(() => {
    if (rangeStart && rangeEnd) {
      return {
        events: events.filter((e: any) => expandOccurrences(e, rangeStart, rangeEnd).length > 0),
        todos: todos.filter((t: any) => inDateRange(t.dueDate)),
        notes: notes
          .filter((n: any) => {
            if (secureFolderId && n.folderId === secureFolderId) return false;
            return inDateRange(n.createdAt) || inDateRange(n.updatedAt);
          })
          .map((n: any) => ({ ...n, folderName: n.folderId ? (folderNameById[n.folderId] || '') : '' })),
      };
    }
    if (!q) return { events: [], todos: [], notes: [] };
    return {
      events: events.filter((e: any) => `${e.title} ${e.location || ''} ${e.description || ''}`.toLowerCase().includes(q)).slice(0, 20),
      todos: todos.filter((t: any) => `${t.title} ${t.memo || ''}`.toLowerCase().includes(q)).slice(0, 20),
      notes: notes
        .filter((n: any) => {
          if (secureFolderId && n.folderId === secureFolderId) return false;
          const folderName = n.folderId ? (folderNameById[n.folderId] || '') : '';
          return `${n.title} ${n.content || ''} ${folderName}`.toLowerCase().includes(q);
        })
        .slice(0, 20)
        .map((n: any) => ({ ...n, folderName: n.folderId ? (folderNameById[n.folderId] || '') : '' })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, date, dateEnd, events, todos, notes, folderNameById, secureFolderId]);

  const total = results.events.length + results.todos.length + results.notes.length;
  if (!q && !date) return null;

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const toggleSelect = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택한 일정 ${selectedIds.length}개를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await Promise.all(selectedIds.map((id) => api.events.remove(id)));
      notify(`${selectedIds.length}개의 일정을 삭제했어요.`);
      setSelected({});
      onRefresh?.();
    } catch (err: any) {
      notify(`삭제 실패: ${err.message || err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteAllResults = async () => {
    if (results.events.length === 0) return;
    if (!confirm(`검색된 일정 ${results.events.length}개를 모두 삭제할까요?`)) return;
    setBusy(true);
    try {
      await Promise.all(results.events.map((e: any) => api.events.remove(e.id)));
      notify(`${results.events.length}개의 일정을 삭제했어요.`);
      setSelected({});
      onRefresh?.();
    } catch (err: any) {
      notify(`삭제 실패: ${err.message || err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = rangeStart && rangeEnd
    ? (isRange ? `${format(rangeStart, 'M월 d일', { locale: ko })} ~ ${format(rangeEnd, 'M월 d일 (EEE)', { locale: ko })}` : format(rangeStart, 'M월 d일 (EEE)', { locale: ko }))
    : '';

  const counts = {
    all: total,
    events: results.events.length,
    todos: results.todos.length,
    notes: results.notes.length,
  };

  const visible = {
    events: category === 'all' || category === 'events',
    todos: category === 'all' || category === 'todos',
    notes: category === 'all' || category === 'notes',
  };

  const tabs: Array<[Category, string]> = [
    ['all', `전체 ${counts.all}`],
    ['events', `일정 ${counts.events}`],
    ['todos', `할일 ${counts.todos}`],
    ['notes', `메모 ${counts.notes}`],
  ];

  const openNote = (n: any) => {
    const info = q ? noteMatchInfo(n, q) : { matchType: 'date' as const, lineIndex: undefined, charOffset: undefined };
    onNote(n, info.matchType, info.lineIndex, info.charOffset);
  };

  const renderEventSection = () => visible.events && results.events.length > 0 ? (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-black text-blue-500 dark:text-blue-400 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />일정</h4>
        <div className="flex items-center gap-1.5">
          {selectedIds.length > 0 && <button disabled={busy} onClick={deleteSelected} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"><Trash2 className="w-3 h-3 inline mr-0.5" />선택삭제({selectedIds.length})</button>}
          <button disabled={busy} onClick={deleteAllResults} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-500/10 text-slate-500 hover:bg-slate-500/20">전체삭제</button>
        </div>
      </div>
      <div className="space-y-1.5">{results.events.map((e: any) => (
        <div key={e.id} className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800">
          <input type="checkbox" className="w-4 h-4 shrink-0 accent-rose-500" checked={!!selected[e.id]} onChange={() => toggleSelect(e.id)} onClick={(ev) => ev.stopPropagation()} />
          <button onClick={() => onEvent(e)} className="flex-1 min-w-0 text-left">
            <span className="font-bold text-sm"><HighlightedText text={e.title || ''} query={q} /></span>
            <span className="block text-[11px] text-slate-500">{e.start.toLocaleDateString('ko-KR')} {e.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
          </button>
        </div>
      ))}</div>
    </section>
  ) : null;

  const renderTodoSection = () => visible.todos && results.todos.length > 0 ? (
    <section>
      <h4 className="text-xs font-black text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-1.5"><CheckSquare className="w-4 h-4" />할 일</h4>
      <div className="space-y-1.5">{results.todos.map((t: any) => (
        <button key={t.id} onClick={() => onTodo(t)} className="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800">
          <span className={`font-bold text-sm ${t.completed ? 'text-slate-500' : ''}`}><HighlightedText text={t.title || ''} query={q} /></span>
          {rangeStart ? (t.completed && <span className="block text-[11px] text-emerald-500">완료됨</span>) : (t.dueDate && <span className="block text-[11px] text-slate-500">기한 {t.dueDate.toLocaleDateString('ko-KR')}</span>)}
        </button>
      ))}</div>
    </section>
  ) : null;

  const renderNoteSection = () => visible.notes && results.notes.length > 0 ? (
    <section>
      <h4 className="text-xs font-black text-amber-500 dark:text-amber-400 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" />메모</h4>
      <div className="space-y-1.5">{results.notes.map((n: any) => {
        const info = noteMatchInfo(n, q);
        const isContentMatch = info.matchType === 'content';
        const isDateSearch = !q;
        const preview = isDateSearch || isContentMatch
          ? noteContentSnippet(n.content || '', isDateSearch ? '' : q)
          : n.content || '';
        return (
          <button key={n.id} onClick={() => openNote(n)} className="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800">
            <span className="font-bold text-sm"><HighlightedText text={n.title || ''} query={q} /></span>
            {preview && (
              <span className={`block text-sm leading-5 text-slate-600 dark:text-slate-300 whitespace-pre-line ${isContentMatch || isDateSearch ? 'line-clamp-3' : ''}`}>
                <HighlightedText text={preview} query={isContentMatch ? q : ''} />
              </span>
            )}
            {isDateSearch && <span className="block text-[10px] text-slate-400 mt-0.5">{n.updatedAt ? format(n.updatedAt, 'M월 d일 HH:mm', { locale: ko }) : ''}</span>}
          </button>
        );
      })}</div>
    </section>
  ) : null;

  return (
    <div
      ref={resultPanelRef}
      className="absolute top-full z-[70] w-[min(42rem,calc(100vw-12.5rem))] md:w-[min(42rem,calc(100vw-12.5rem))] max-sm:w-[calc(100vw-1rem)] max-h-[78vh] overflow-hidden rounded-2xl border border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
      style={{
        left: resultLeft == null ? 0 : String(resultLeft) + 'px',
        marginTop: pushDownBy ? String(pushDownBy) + 'px' : '0.5rem',
      }}
    >
      <div className="p-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">{dateLabel ? `${dateLabel} 전체 기록 ${total}건` : `검색 결과 ${total}건`}</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-3 pt-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`px-3 py-2 rounded-t-lg text-xs font-bold whitespace-nowrap ${category === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {total === 0 ? <div className="p-8 text-center text-sm text-slate-500">검색 결과가 없습니다.</div> : (
        <div className="p-3 space-y-4 max-h-[calc(78vh-7rem)] overflow-y-auto">
          {renderEventSection()}
          {renderTodoSection()}
          {renderNoteSection()}
        </div>
      )}
    </div>
  );
}
