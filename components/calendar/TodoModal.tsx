'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../lib/api-client';
import { autoPriorityForDueDate } from '../../lib/todoAutoColor';
import { useModalBackClose } from '../../lib/useModalBackClose';
import { useRecentInputs } from '../../lib/useRecentInputs';
import { Calendar as CalIcon, Trash2, X, AlignLeft, Folder } from 'lucide-react';

const PRIORITIES = [
  { key: 'red', dot: 'bg-rose-500', ring: 'ring-rose-500' },
  { key: 'yellow', dot: 'bg-amber-400', ring: 'ring-amber-400' },
  { key: 'green', dot: 'bg-emerald-500', ring: 'ring-emerald-500' },
];

/** 구글 검색창처럼 최근 입력값을 입력창 아래에 후보로 보여주는 작은 재사용 UI. */
function AutocompleteDropdown({ suggestions, onSelect }: { suggestions: string[]; onSelect: (v: string) => void }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(s)}
          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 truncate"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// todo가 없으면(null) "새 할일 만들기" 모드, 있으면 수정 모드로 동작한다.
export default function TodoModal({ todo, folders = [], defaultFolderId = null, notify, onClose, onRefresh }: any) {
  useModalBackClose(onClose);
  const isEdit = !!todo;
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');
  const [priority, setPriority] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [titleSuggestOpen, setTitleSuggestOpen] = useState(false);
  const { remember, suggestionsFor } = useRecentInputs('todo-title');

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title || '');
    setDueDate(todo.dueDate ? format(todo.dueDate, 'yyyy-MM-dd') : '');
    setMemo(todo.memo || '');
    setPriority(todo.priority || null);
    setFolderId(todo.folderId || null);
  }, [todo]);

  const notifyFn = notify || (() => {});

  // 저장/삭제 결과를 기다리지 않고 즉시 닫는다(낙관적 UI) - 캘린더 일정 모달과 동일한 방식.
  const save = () => {
    if (!title.trim()) return;
    const t = title.trim();
    const d = dueDate;
    const m = memo;
    const p = priority;
    const f = folderId;
    remember(t);

    if (!isEdit) {
      onClose();
      api.todos.create({ title: t, completed: false, dueDate: d ? new Date(d).toISOString() : null, memo: m, priority: p, folderId: f })
        .then(() => { notifyFn('할 일이 추가되었습니다.'); onRefresh?.(); })
        .catch((err: any) => { console.error(err); notifyFn(`추가 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
      return;
    }

    const id = todo.id;
    const priorityChanged = p !== (todo.priority || null);
    onClose();

    api.todos.update(id, {
      title: t,
      dueDate: d ? new Date(d).toISOString() : null,
      memo: m,
      priority: p,
      folderId: f,
      bumpToTop: priorityChanged && !!p,
    })
      .then(() => { notifyFn('할 일이 수정되었습니다.'); onRefresh?.(); })
      .catch((err: any) => {
        console.error(err);
        notifyFn(`수정 실패: ${err.isTimeout ? err.message : (err.message || err)}`, 'error');
        onRefresh?.(); // 타임아웃 등으로 실패 토스트가 떠도 서버엔 이미 반영됐을 수 있어, 항상 최신 상태로 동기화
      });
  };

  const remove = () => {
    if (!todo || !confirm('삭제할까요?')) return;
    const id = todo.id;
    onClose();

    api.todos.remove(id)
      .then(() => { notifyFn('할 일이 삭제되었습니다.'); onRefresh?.(); })
      .catch((err: any) => {
        console.error(err);
        notifyFn(`삭제 실패: ${err.isTimeout ? err.message : (err.message || err)}`, 'error');
        onRefresh?.();
      });
  };

  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    // 기한을 (다시) 설정하면 급한 정도에 따라 색깔원을 자동으로 골라줌 (빠른추가와 동일한 규칙)
    const autoPriority = autoPriorityForDueDate(value);
    if (autoPriority) setPriority(autoPriority);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl text-white">{isEdit ? '할 일 수정' : '새 할 일'}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X/></button>
          </div>
          <div className="relative">
            <input
              autoFocus
              className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-700 pb-2"
              placeholder="할 일 내용"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setTitleSuggestOpen(true)}
              onBlur={() => setTimeout(() => setTitleSuggestOpen(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            />
            {titleSuggestOpen && <AutocompleteDropdown suggestions={suggestionsFor(title)} onSelect={(v) => { setTitle(v); setTitleSuggestOpen(false); }} />}
          </div>

          <div className="flex items-center justify-center gap-4 py-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(priority === p.key ? null : p.key)}
                title={p.key === 'red' ? '긴급' : p.key === 'yellow' ? '보통' : '여유'}
                className={`w-7 h-7 rounded-full ${p.dot} transition ${priority === p.key ? `ring-4 ring-offset-2 ring-offset-slate-900 ${p.ring} scale-110` : 'opacity-40 hover:opacity-80'}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl">
            <CalIcon className="w-4 h-4 text-slate-500" />
            <input type="date" className="bg-transparent flex-1 outline-none text-sm" value={dueDate} onChange={(e) => handleDueDateChange(e.target.value)} />
            {dueDate && (
              <button onClick={() => setDueDate('')} className="text-[10px] text-slate-500 hover:text-rose-400">날짜 제거</button>
            )}
          </div>
          <div className="flex items-start gap-3 bg-slate-800 p-3 rounded-2xl">
            <AlignLeft className="w-4 h-4 text-slate-500 mt-1" />
            <textarea className="bg-transparent flex-1 outline-none text-sm h-16 resize-none" placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {folders.length > 0 && (
            <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl">
              <Folder className="w-4 h-4 text-slate-500 shrink-0" />
              <select className="bg-transparent flex-1 outline-none text-sm" value={folderId || ''} onChange={(e) => setFolderId(e.target.value || null)}>
                <option value="">미분류</option>
                {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            {isEdit && <button onClick={remove} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2/></button>}
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-400">취소</button>
            <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">{isEdit ? '저장' : '추가'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
