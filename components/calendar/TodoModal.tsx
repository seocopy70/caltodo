'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../lib/api-client';
import { Calendar as CalIcon, Trash2, X, AlignLeft } from 'lucide-react';

export default function TodoModal({ todo, notify, onClose, onRefresh }: any) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title || '');
    setDueDate(todo.dueDate ? format(todo.dueDate, 'yyyy-MM-dd') : '');
    setMemo(todo.memo || '');
  }, [todo]);

  const notifyFn = notify || (() => {});
  if (!todo) return null;

  // 저장/삭제 결과를 기다리지 않고 즉시 닫는다(낙관적 UI) - 캘린더 일정 모달과 동일한 방식.
  const save = () => {
    if (!title.trim()) return;
    const id = todo.id;
    const t = title.trim();
    const d = dueDate;
    const m = memo;
    onClose();

    api.todos.update(id, {
      title: t,
      dueDate: d ? new Date(d).toISOString() : null,
      memo: m,
    })
      .then(() => { notifyFn('할 일이 수정되었습니다.'); onRefresh?.(); })
      .catch((err: any) => {
        console.error(err);
        notifyFn(`수정 실패: ${err.isTimeout ? err.message : (err.message || err)}`, 'error');
      });
  };

  const remove = () => {
    if (!confirm('삭제할까요?')) return;
    const id = todo.id;
    onClose();

    api.todos.remove(id)
      .then(() => { notifyFn('할 일이 삭제되었습니다.'); onRefresh?.(); })
      .catch((err: any) => {
        console.error(err);
        notifyFn(`삭제 실패: ${err.isTimeout ? err.message : (err.message || err)}`, 'error');
      });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl text-white">할 일 수정</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X/></button>
          </div>
          <input autoFocus className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-700 pb-2" placeholder="할 일 내용" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl">
            <CalIcon className="w-4 h-4 text-slate-500" />
            <input type="date" className="bg-transparent flex-1 outline-none text-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {dueDate && (
              <button onClick={() => setDueDate('')} className="text-[10px] text-slate-500 hover:text-rose-400">날짜 제거</button>
            )}
          </div>
          <div className="flex items-start gap-3 bg-slate-800 p-3 rounded-2xl">
            <AlignLeft className="w-4 h-4 text-slate-500 mt-1" />
            <textarea className="bg-transparent flex-1 outline-none text-sm h-16 resize-none" placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={remove} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2/></button>
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-400">취소</button>
            <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
