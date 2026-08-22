'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format, isToday } from 'date-fns';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalIcon } from 'lucide-react';

export default function TodoView({ todos, user }: any) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || !user) return;
    try {
      await addDoc(collection(db, "todos"), {
        title: newTodo,
        userId: user.uid,
        completed: false,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        createdAt: Timestamp.now()
      });
      setNewTodo(''); setDueDate('');
    } catch (e) { console.error(e); }
  };

  const activeTodos = todos.filter((t: any) => !t.completed);
  const completedTodos = todos.filter((t: any) => t.completed);

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-2">
      <form onSubmit={addTodo} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600" />
          <input className="bg-transparent flex-1 outline-none text-lg" placeholder="새로운 할 일..." value={newTodo} onChange={(e) => setNewTodo(e.target.value)} />
          <button type="submit" className="p-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition"><Plus className="w-6 h-6 text-white" /></button>
        </div>
        <div className="flex items-center gap-2 pl-10 text-slate-400">
          <CalIcon className="w-4 h-4" />
          <input type="date" className="bg-transparent text-xs outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </form>

      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 px-2 flex items-center gap-2">진행 중 <span className="bg-blue-500/20 text-blue-400 px-2 rounded">{activeTodos.length}</span></h3>
          <div className="space-y-2">
            {activeTodos.map((todo: any) => (
              <div key={todo.id} className="group flex items-center gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 hover:border-blue-500/50 transition">
                <button onClick={() => updateDoc(doc(db, "todos", todo.id), { completed: true })}>
                  <Circle className="w-6 h-6 text-slate-600 hover:text-blue-500" />
                </button>
                <div className="flex-1">
                  <p className="font-medium">{todo.title}</p>
                  {todo.dueDate && <p className={`text-[10px] font-bold mt-1 ${isToday(todo.dueDate) ? 'text-orange-400' : 'text-slate-500'}`}>{format(todo.dueDate, 'M월 d일')}</p>}
                </div>
                <button onClick={() => deleteDoc(doc(db, "todos", todo.id))} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
        </section>

        {completedTodos.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-600 px-2">완료됨</h3>
            <div className="space-y-2 opacity-50">
              {completedTodos.map((todo: any) => (
                <div key={todo.id} className="flex items-center gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
                  <button onClick={() => updateDoc(doc(db, "todos", todo.id), { completed: false })}>
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </button>
                  <p className="flex-1 line-through text-slate-500">{todo.title}</p>
                  <button onClick={() => deleteDoc(doc(db, "todos", todo.id))} className="text-slate-700 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}