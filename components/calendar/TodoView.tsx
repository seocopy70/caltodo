'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format, isToday } from 'date-fns';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalIcon, X } from 'lucide-react';
import { withTimeout } from '../../lib/withTimeout';

export default function TodoView({ todos, user, onNotify }: any) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const notify = onNotify || (() => {});

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title || !user) return;

    // 즉시 입력창을 비워서 다음 입력을 바로 이어갈 수 있게 함
    const savedDueDate = dueDate;
    setNewTodo('');
    setDueDate('');

    try {
      await withTimeout(addDoc(collection(db, "todos"), {
        title,
        userId: user.uid,
        completed: false,
        dueDate: savedDueDate ? Timestamp.fromDate(new Date(savedDueDate)) : null,
        createdAt: Timestamp.now()
      }));
      notify('할 일이 추가되었습니다.');
    } catch (err: any) {
      console.error(err);
      // 타임아웃/실패해도 입력창을 다시 채우지 않음 - 그 사이 사용자가 이미
      // 다른 내용을 입력했을 수 있어, 덮어쓰면 오히려 데이터가 뒤섞이는 버그가 됨.
      // 실제로 저장에 실패했다면 목록에 해당 항목이 보이지 않을 것이므로,
      // 에러 메시지만 보여주고 필요하면 사용자가 직접 다시 입력하게 한다.
      notify(`추가 확인 필요: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    try {
      await withTimeout(updateDoc(doc(db, "todos", id), { completed }));
    } catch (err: any) {
      console.error(err);
      notify(`업데이트 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    }
  };

  const removeTodo = async (id: string) => {
    try {
      await withTimeout(deleteDoc(doc(db, "todos", id)));
      notify('할 일이 삭제되었습니다.');
    } catch (err: any) {
      console.error(err);
      notify(`삭제 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    }
  };

  const openEdit = (todo: any) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditDueDate(todo.dueDate ? format(todo.dueDate, 'yyyy-MM-dd') : '');
  };

  const closeEdit = () => {
    setEditingTodo(null);
    setEditTitle('');
    setEditDueDate('');
  };

  const saveEdit = async () => {
    if (!editingTodo || !editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      await withTimeout(updateDoc(doc(db, "todos", editingTodo.id), {
        title: editTitle.trim(),
        dueDate: editDueDate ? Timestamp.fromDate(new Date(editDueDate)) : null,
      }));
      notify('할 일이 수정되었습니다.');
      closeEdit();
    } catch (err: any) {
      console.error(err);
      notify(`수정 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteFromEdit = async () => {
    if (!editingTodo || !confirm('삭제할까요?')) return;
    setIsSavingEdit(true);
    try {
      await withTimeout(deleteDoc(doc(db, "todos", editingTodo.id)));
      notify('할 일이 삭제되었습니다.');
      closeEdit();
    } catch (err: any) {
      console.error(err);
      notify(`삭제 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const activeTodos = todos.filter((t: any) => !t.completed);
  const completedTodos = todos.filter((t: any) => t.completed);

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-2">
      <form onSubmit={addTodo} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600" />
          <input className="bg-transparent flex-1 outline-none text-lg" placeholder="새로운 할 일..." value={newTodo} onChange={(e) => setNewTodo(e.target.value)} />
          <button type="submit" className="p-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition">
            <Plus className="w-6 h-6 text-white" />
          </button>
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
                <button onClick={() => toggleTodo(todo.id, true)}>
                  <Circle className="w-6 h-6 text-slate-600 hover:text-blue-500" />
                </button>
                <div className="flex-1 flex items-center justify-between gap-3 cursor-pointer" onClick={() => openEdit(todo)}>
                  <p className="font-medium truncate">{todo.title}</p>
                  {todo.dueDate && <p className={`text-[10px] font-bold shrink-0 ${isToday(todo.dueDate) ? 'text-orange-400' : 'text-slate-500'}`}>{format(todo.dueDate, 'M월 d일')}</p>}
                </div>
                <button onClick={() => removeTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-4 h-4"/></button>
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
                  <button onClick={() => toggleTodo(todo.id, false)}>
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </button>
                  <div className="flex-1 flex items-center justify-between gap-3 cursor-pointer" onClick={() => openEdit(todo)}>
                    <p className="line-through text-slate-500 truncate">{todo.title}</p>
                    {todo.dueDate && <p className="text-[10px] font-bold shrink-0 text-slate-600">{format(todo.dueDate, 'M월 d일')}</p>}
                  </div>
                  <button onClick={() => removeTodo(todo.id)} className="text-slate-700 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {editingTodo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xl text-white">할 일 수정</h3>
                <button onClick={closeEdit} className="p-1 hover:bg-slate-800 rounded-full"><X/></button>
              </div>
              <input autoFocus className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-700 pb-2" placeholder="할 일 내용" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl">
                <CalIcon className="w-4 h-4 text-slate-500" />
                <input type="date" className="bg-transparent flex-1 outline-none text-sm" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                {editDueDate && (
                  <button onClick={() => setEditDueDate('')} className="text-[10px] text-slate-500 hover:text-rose-400">날짜 제거</button>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button disabled={isSavingEdit} onClick={deleteFromEdit} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl disabled:opacity-40"><Trash2/></button>
                <button disabled={isSavingEdit} onClick={closeEdit} className="flex-1 py-3 font-bold text-slate-400 disabled:opacity-40">취소</button>
                <button disabled={isSavingEdit} onClick={saveEdit} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold disabled:opacity-60">
                  {isSavingEdit ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
