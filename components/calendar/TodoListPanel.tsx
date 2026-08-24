'use client';

import { useRef, useState } from 'react';
import { format, isToday } from 'date-fns';
import { CalendarDays, CheckCircle2, Circle, ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import TodoModal from './TodoModal';

const PRIORITIES = [
  { key: 'red', dot: 'bg-rose-500', ring: 'ring-rose-500', text: 'text-rose-500' },
  { key: 'yellow', dot: 'bg-amber-400', ring: 'ring-amber-400', text: 'text-amber-500' },
  { key: 'green', dot: 'bg-emerald-500', ring: 'ring-emerald-500', text: 'text-emerald-500' },
];

function priorityRank(t: any) {
  if (t.priority === 'red') return 0;
  if (t.priority === 'yellow') return 1;
  if (t.priority === 'green') return 2;
  return 3;
}

function sortActive(a: any, b: any) {
  const pr = priorityRank(a) - priorityRank(b);
  if (pr !== 0) return pr;
  const aHas = !!a.dueDate, bHas = !!b.dueDate;
  if (aHas && bHas) return a.dueDate.getTime() - b.dueDate.getTime();
  if (aHas !== bHas) return aHas ? -1 : 1;
  return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
}

function CheckButton({ priority, onClick }: { priority: string | null; onClick: () => void }) {
  const p = PRIORITIES.find((x) => x.key === priority);
  return (
    <button onClick={onClick} className="shrink-0">
      <Circle className={`w-5 h-5 ${p ? p.text : 'text-slate-500 hover:text-blue-500'}`} fill={p ? 'currentColor' : 'none'} fillOpacity={p ? 0.25 : undefined} />
    </button>
  );
}

export default function TodoListPanel({
  todos,
  user,
  onNotify,
  onRefresh,
  maxVisible,
  compact = false,
}: any) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [showMore, setShowMore] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const notify = onNotify || (() => {});

  const activeTodos = todos.filter((t: any) => !t.completed).sort(sortActive);
  const completedTodos = todos
    .filter((t: any) => t.completed)
    .sort((a: any, b: any) => {
      const at = a.completedAt?.getTime?.() ?? a.createdAt?.getTime?.() ?? 0;
      const bt = b.completedAt?.getTime?.() ?? b.createdAt?.getTime?.() ?? 0;
      return bt - at;
    });

  const visibleTodos = maxVisible && !showMore ? activeTodos.slice(0, maxVisible) : activeTodos;

  const resetComposer = () => { setNewTodo(''); setDueDate(''); setPriority(null); };

  const createTodo = async (overrides: { dueDate?: string; priority?: string | null } = {}) => {
    const title = newTodo.trim();
    if (!title || !user) return;
    const finalDueDate = overrides.dueDate !== undefined ? overrides.dueDate : dueDate;
    const finalPriority = overrides.priority !== undefined ? overrides.priority : priority;
    resetComposer();
    try {
      await api.todos.create({
        title,
        completed: false,
        dueDate: finalDueDate ? new Date(finalDueDate).toISOString() : null,
        memo: '',
        priority: finalPriority || null,
      });
      notify('할 일이 추가되었습니다.');
      onRefresh?.();
    } catch (err: any) {
      notify(`추가 실패: ${err.message || err}`, 'error');
    }
  };

  const addTodo = async (e: React.FormEvent) => { e.preventDefault(); await createTodo(); };

  // 제목이 입력된 상태에서 날짜를 고르거나 색깔원을 누르면 즉시 저장한다.
  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    if (newTodo.trim()) createTodo({ dueDate: value });
  };
  const handlePriorityClick = (key: string) => {
    const next = priority === key ? null : key;
    setPriority(next);
    if (newTodo.trim()) createTodo({ priority: next });
  };

  const toggleTodo = (id: string, completed: boolean) => {
    api.todos.update(id, { completed })
      .then(() => onRefresh?.())
      .catch((err: any) => notify(`업데이트 실패: ${err.message || err}`, 'error'));
  };

  const removeTodo = (id: string) => {
    if (!confirm('삭제할까요?')) return;
    api.todos.remove(id)
      .then(() => { notify('할 일이 삭제되었습니다.'); onRefresh?.(); })
      .catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };

  const dropOn = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ordered = [...activeTodos];
    const from = ordered.findIndex((t) => t.id === dragId);
    const to = ordered.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    try {
      await Promise.all(ordered.map((t, i) => api.todos.update(t.id, { orderIndex: i })));
      onRefresh?.();
    } finally {
      setDragId(null);
    }
  };

  return (
    <section className={`rounded-2xl border border-slate-700/50 bg-slate-900/30 overflow-hidden ${compact ? '' : 'shadow-xl'}`}>
      <form onSubmit={addTodo} className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/40">
        <Circle className="w-5 h-5 text-slate-500 shrink-0" />
        <input
          className="flex-1 min-w-0 bg-transparent outline-none text-sm"
          placeholder="＿＿＿"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
        />
        <div className="flex items-center gap-1 shrink-0">
          {PRIORITIES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePriorityClick(p.key)}
              title={p.key === 'red' ? '긴급' : p.key === 'yellow' ? '보통' : '여유'}
              className={`w-4 h-4 rounded-full ${p.dot} transition ${priority === p.key ? `ring-2 ring-offset-2 ring-offset-slate-900 ${p.ring} scale-110` : 'opacity-40 hover:opacity-80'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => dateRef.current?.showPicker?.() || dateRef.current?.focus()}
          className={`p-1.5 rounded-lg transition ${dueDate ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-blue-400 hover:bg-blue-500/10'}`}
          title="할 일 기한"
        >
          <CalendarDays className="w-5 h-5" />
        </button>
        <input
          ref={dateRef}
          type="date"
          value={dueDate}
          onChange={(e) => handleDueDateChange(e.target.value)}
          className="sr-only"
        />
      </form>

      <div className="divide-y divide-slate-700/30">
        {visibleTodos.map((todo: any) => (
          <div
            key={todo.id}
            draggable
            onDragStart={() => setDragId(todo.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(todo.id)}
            className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-800/20 transition"
          >
            <GripVertical className="w-4 h-4 text-slate-600 cursor-grab shrink-0" />
            <CheckButton priority={todo.priority} onClick={() => toggleTodo(todo.id, true)} />
            <div onClick={() => setEditingTodo(todo)} className="flex-1 min-w-0 cursor-pointer flex items-center gap-3">
              <span className="text-sm font-medium truncate">{todo.title}</span>
              {todo.dueDate && <span className={`text-sm font-medium shrink-0 ${isToday(todo.dueDate) ? 'text-orange-400' : 'text-slate-400'}`}>{format(todo.dueDate, 'M/d')}</span>}
            </div>
            <button onClick={() => removeTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {activeTodos.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-600">할 일이 없습니다.</div>}

      {maxVisible && activeTodos.length > maxVisible && (
        <button onClick={() => setShowMore((v) => !v)} className="w-full px-4 py-2.5 border-t border-slate-700/30 text-xs font-bold text-slate-500 hover:text-blue-400 transition">
          {showMore ? '접기' : `더 보기 (${activeTodos.length - maxVisible}개)`}
        </button>
      )}

      {completedTodos.length > 0 && (
        <div className="border-t border-slate-700/40">
          <button onClick={() => setShowCompleted((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-300">
            {showCompleted ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            완료됨 <span className="bg-slate-700 px-1.5 rounded">{completedTodos.length}</span>
          </button>
          {showCompleted && (
            <div className="divide-y divide-slate-700/20 opacity-55">
              {completedTodos.map((todo: any) => (
                <div key={todo.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleTodo(todo.id, false)} className="shrink-0"><CheckCircle2 className="w-5 h-5 text-blue-500" /></button>
                  <div onClick={() => setEditingTodo(todo)} className="flex-1 min-w-0 cursor-pointer flex items-center gap-3">
                    <span className="text-sm line-through text-slate-500 truncate">{todo.title}</span>
                    {todo.completedAt && <span className="text-sm text-slate-500 shrink-0">{format(todo.completedAt, 'M/d')}</span>}
                  </div>
                  <button onClick={() => removeTodo(todo.id)} className="text-slate-700 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingTodo && <TodoModal todo={editingTodo} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={onRefresh} />}
    </section>
  );
}
