'use client';

import { useMemo } from 'react';
import { CalendarDays, CheckSquare, FileText, X } from 'lucide-react';

export default function GlobalSearch({ query, events, todos, notes, onClose, onEvent, onTodo, onNote }: any) {
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return { events: [], todos: [], notes: [] };
    return {
      events: events.filter((e: any) => `${e.title} ${e.location || ''} ${e.description || ''}`.toLowerCase().includes(q)).slice(0, 20),
      todos: todos.filter((t: any) => `${t.title} ${t.memo || ''}`.toLowerCase().includes(q)).slice(0, 20),
      notes: notes.filter((n: any) => `${n.title} ${n.content || ''}`.toLowerCase().includes(q)).slice(0, 20),
    };
  }, [q, events, todos, notes]);

  const total = results.events.length + results.todos.length + results.notes.length;
  if (!q) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 z-[70] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
      <div className="p-3 flex items-center justify-between border-b border-slate-800">
        <span className="text-xs text-slate-400">검색 결과 {total}건</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800"><X className="w-4 h-4" /></button>
      </div>
      {total === 0 ? <div className="p-8 text-center text-sm text-slate-500">검색 결과가 없습니다.</div> : (
        <div className="p-3 space-y-4">
          {results.events.length > 0 && <section>
            <h4 className="text-xs font-black text-blue-400 mb-2 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />일정</h4>
            <div className="space-y-1.5">{results.events.map((e: any) => <button key={e.id} onClick={() => onEvent(e)} className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800"><span className="font-bold text-sm">{e.title}</span><span className="block text-[11px] text-slate-500">{e.start.toLocaleDateString('ko-KR')} {e.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></button>)}</div>
          </section>}
          {results.todos.length > 0 && <section>
            <h4 className="text-xs font-black text-emerald-400 mb-2 flex items-center gap-1.5"><CheckSquare className="w-4 h-4" />할 일</h4>
            <div className="space-y-1.5">{results.todos.map((t: any) => <button key={t.id} onClick={() => onTodo(t)} className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800"><span className={`font-bold text-sm ${t.completed ? 'line-through text-slate-500' : ''}`}>{t.title}</span>{t.dueDate && <span className="block text-[11px] text-slate-500">기한 {t.dueDate.toLocaleDateString('ko-KR')}</span>}</button>)}</div>
          </section>}
          {results.notes.length > 0 && <section>
            <h4 className="text-xs font-black text-amber-400 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" />메모</h4>
            <div className="space-y-1.5">{results.notes.map((n: any) => <button key={n.id} onClick={() => onNote(n)} className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800"><span className="font-bold text-sm">{n.title}</span><span className="block text-[11px] text-slate-500 line-clamp-1">{n.content}</span></button>)}</div>
          </section>}
        </div>
      )}
    </div>
  );
}
