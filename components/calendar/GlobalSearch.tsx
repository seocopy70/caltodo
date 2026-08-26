'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CheckSquare, FileText, X, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';

export default function GlobalSearch({ query, events, todos, notes, folders = [], onClose, onEvent, onTodo, onNote, onRefresh, onNotify }: any) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const notify = onNotify || (() => {});
  const q = query.trim().toLowerCase();
  const folderNameById = useMemo(() => Object.fromEntries(folders.map((f: any) => [f.id, f.name])), [folders]);
  const results = useMemo(() => {
    if (!q) return { events: [], todos: [], notes: [] };
    return {
      events: events.filter((e: any) => `${e.title} ${e.location || ''} ${e.description || ''}`.toLowerCase().includes(q)).slice(0, 20),
      todos: todos.filter((t: any) => `${t.title} ${t.memo || ''}`.toLowerCase().includes(q)).slice(0, 20),
      notes: notes.filter((n: any) => {
        const folderName = n.folderId ? (folderNameById[n.folderId] || '') : '';
        const haystack = n.locked ? `${n.title} ${folderName}` : `${n.title} ${n.content || ''} ${folderName}`;
        return haystack.toLowerCase().includes(q);
      }).slice(0, 20),
    };
  }, [q, events, todos, notes, folderNameById]);

  const total = results.events.length + results.todos.length + results.notes.length;
  if (!q) return null;

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

  return (
    <div className="absolute right-0 top-full mt-2 z-[70] w-[min(92vw,26rem)] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
      <div className="p-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">검색 결과 {total}건</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
      </div>
      {total === 0 ? <div className="p-8 text-center text-sm text-slate-500">검색 결과가 없습니다.</div> : (
        <div className="p-3 space-y-4">
          {results.events.length > 0 && <section>
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
                  <span className="font-bold text-sm">{e.title}</span>
                  <span className="block text-[11px] text-slate-500">{e.start.toLocaleDateString('ko-KR')} {e.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              </div>
            ))}</div>
          </section>}
          {results.todos.length > 0 && <section>
            <h4 className="text-xs font-black text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-1.5"><CheckSquare className="w-4 h-4" />할 일</h4>
            <div className="space-y-1.5">{results.todos.map((t: any) => <button key={t.id} onClick={() => onTodo(t)} className="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800"><span className={`font-bold text-sm ${t.completed ? 'line-through text-slate-500' : ''}`}>{t.title}</span>{t.dueDate && <span className="block text-[11px] text-slate-500">기한 {t.dueDate.toLocaleDateString('ko-KR')}</span>}</button>)}</div>
          </section>}
          {results.notes.length > 0 && <section>
            <h4 className="text-xs font-black text-amber-500 dark:text-amber-400 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" />메모</h4>
            <div className="space-y-1.5">{results.notes.map((n: any) => <button key={n.id} onClick={() => onNote(n)} className="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800"><span className="font-bold text-sm">{n.locked ? '비밀 메모' : n.title}</span>{!n.locked && <span className="block text-[11px] text-slate-500 line-clamp-1">{n.content}</span>}</button>)}</div>
          </section>}
        </div>
      )}
    </div>
  );
}
