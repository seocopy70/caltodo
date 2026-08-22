'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format, isToday, isFuture } from 'date-fns';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalIcon } from 'lucide-react';

interface TodoViewProps {
  todos: any[];
  db: any;
}

export default function TodoView({ todos }: TodoViewProps) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    await addDoc(collection(db, "todos"), {
      title: newTodo,
      completed: false,
      dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
      createdAt: Timestamp.now()
    });
    setNewTodo('');
    setDueDate('');
  };

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "todos", id), {
      completed: !currentStatus
    });
  };

  const deleteTodo = async (id: string) => {
    if (confirm('할 일을 삭제할까요?')) {
      await deleteDoc(doc(db, "todos", id));
    }
  };

  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* 할일 입력창 */}
      <form onSubmit={addTodo} className="bg-slate-800 p-4 rounded-xl shadow-lg space-y-3 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600 flex-shrink-0" />
          <input 
            className="bg-transparent flex-1 focus:outline-none text-lg placeholder:text-slate-500"
            placeholder="새로운 할 일..."
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          />
          <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition">
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex items-center gap-2 pl-9">
          <CalIcon className="w-4 h-4 text-slate-500" />
          <input 
            type="date"
            className="bg-slate-700 text-xs p-1 rounded text-slate-300 focus:outline-none"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </form>

      {/* 활성 할일 목록 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
          진행 중 <span className="bg-slate-800 px-2 py-0.5 rounded-full text-xs">{activeTodos.length}</span>
        </h3>
        <div className="space-y-2">
          {activeTodos.map(todo => (
            <div key={todo.id} className="group flex items-center gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 hover:border-blue-500/50 transition">
              <button onClick={() => toggleTodo(todo.id, todo.completed)}>
                <Circle className="w-6 h-6 text-slate-500 hover:text-blue-400" />
              </button>
              <div className="flex-1">
                <p className="text-slate-200">{todo.title}</p>
                {todo.dueDate && (
                  <p className={`text-[10px] mt-0.5 ${isToday(todo.dueDate) ? 'text-orange-400 font-bold' : 'text-slate-500'}`}>
                    기한: {format(todo.dueDate, 'M월 d일')}
                  </p>
                )}
              </div>
              <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 완료된 할일 목록 */}
      {completedTodos.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500">완료됨</h3>
          <div className="space-y-2 opacity-60">
            {completedTodos.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <button onClick={() => toggleTodo(todo.id, todo.completed)}>
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </button>
                <p className="flex-1 text-slate-500 line-through text-sm">{todo.title}</p>
                <button onClick={() => deleteTodo(todo.id)} className="p-2 text-slate-600 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}