'use client';

import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Plus, Trash2, CheckCircle2, Circle, GripVertical, Calendar as CalIcon, ChevronDown, ChevronRight } from 'lucide-react';
import TodoModal from './TodoModal';

export default function TodoView({ todos, user, onNotify, onRefresh }: any) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const notify = onNotify || (() => {});

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title || !user) return;
    setNewTodo(''); setDueDate('');
    try {
      await api.todos.create({ title, completed: false, dueDate: dueDate ? new Date(dueDate).toISOString() : null, memo: '' });
      notify('할 일이 추가되었습니다.'); onRefresh?.();
    } catch (err: any) { notify(`추가 실패: ${err.message || err}`, 'error'); }
  };

  const toggleTodo = (id: string, completed: boolean) => api.todos.update(id, { completed }).then(() => onRefresh?.()).catch((err: any) => notify(`업데이트 실패: ${err.message || err}`, 'error'));
  const removeTodo = (id: string) => { if (!confirm('삭제할까요?')) return; api.todos.remove(id).then(() => { notify('할 일이 삭제되었습니다.'); onRefresh?.(); }); };

  const activeTodos = todos.filter((t: any) => !t.completed).sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const completedTodos = todos.filter((t: any) => t.completed).sort((a: any, b: any) => (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || ''));

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
    } finally { setDragId(null); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-2">
      <form onSubmit={addTodo} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 shadow-xl space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600" />
          <input className="bg-transparent flex-1 outline-none text-lg" placeholder="새로운 할 일..." value={newTodo} onChange={(e) => setNewTodo(e.target.value)} />
          <button type="submit" className="p-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition"><Plus className="w-6 h-6 text-white" /></button>
        </div>
        <div className="flex items-center gap-2 pl-10 text-slate-400">
          <CalIcon className="w-4 h-4" />
          <span className="text-xs">기한</span>
          <input type="date" className="bg-transparent text-xs outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {dueDate && <button type="button" onClick={() => setDueDate('')} className="text-[10px] text-slate-500">지우기</button>}
        </div>
      </form>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 px-2 flex items-center gap-2">진행 중 <span className="bg-blue-500/20 text-blue-400 px-2 rounded">{activeTodos.length}</span></h3>
        <div className="space-y-2">
          {activeTodos.map((todo: any) => (
            <div key={todo.id} draggable onDragStart={() => setDragId(todo.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(todo.id)} className="group flex items-center gap-3 bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 hover:border-blue-500/50 transition">
              <GripVertical className="w-4 h-4 text-slate-600 cursor-grab shrink-0" />
              <button onClick={() => toggleTodo(todo.id, true)}><Circle className="w-6 h-6 text-slate-600 hover:text-blue-500" /></button>
              <div className="flex-1 flex items-center justify-between gap-3 cursor-pointer" onClick={() => setEditingTodo(todo)}>
                <p className="font-medium truncate">{todo.title}</p>
                {todo.dueDate && <p className={`text-[10px] font-bold shrink-0 ${isToday(todo.dueDate) ? 'text-orange-400' : 'text-slate-500'}`}>{format(todo.dueDate, 'M월 d일')}</p>}
              </div>
              <button onClick={() => removeTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
      </section>

      {completedTodos.length > 0 && <section className="space-y-3">
        <button onClick={() => setShowCompleted(v => !v)} className="w-full flex items-center gap-2 text-sm font-bold text-slate-500 px-2">{showCompleted ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>} 완료됨 <span className="bg-slate-700 px-2 rounded">{completedTodos.length}</span></button>
        {showCompleted && <div className="space-y-2 opacity-55">
          {completedTodos.map((todo: any) => <div key={todo.id} className="flex items-center gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <button onClick={() => toggleTodo(todo.id, false)}><CheckCircle2 className="w-6 h-6 text-blue-500" /></button>
            <div className="flex-1 flex items-center justify-between gap-3 cursor-pointer" onClick={() => setEditingTodo(todo)}>
              <p className="line-through text-slate-500 truncate">{todo.title}</p>
              {todo.dueDate && <p className="text-[10px] font-bold shrink-0 text-slate-600">{format(todo.dueDate, 'M월 d일')}</p>}
            </div>
            <button onClick={() => removeTodo(todo.id)} className="text-slate-700 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
          </div>)}
        </div>}
      </section>}

      {editingTodo && <TodoModal todo={editingTodo} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={onRefresh} />}
    </div>
  );
}
