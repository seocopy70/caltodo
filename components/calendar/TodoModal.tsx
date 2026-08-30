'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../lib/api-client';
import { autoPriorityForDueDate } from '../../lib/todoAutoColor';
import { useModalBackClose, ModalBackCloseGuard } from '../../lib/useModalBackClose';
import { useRecentInputs } from '../../lib/useRecentInputs';
import { Calendar as CalIcon, Trash2, X, AlignLeft, Folder } from 'lucide-react';

// 할일에 날짜를 설정할 때 "일정으로도 저장할까요?"를 매번 물어보지 않도록 하는 사용자 선택 저장 키.
// 'ask'(기본, 매번 물어봄) | 'always'(항상 일정 연동) | 'never'(항상 연동 안 함)
const LINK_PREF_KEY = 'cal2do-todo-event-link-pref';

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
  // 현재 설정된 날짜를 실제로 일정에도 연동할지 여부. 기존에 이미 연동된 할일을 열면 'yes'로,
  // 날짜는 있지만 연동이 안 되어있던 할일은 'no'로 시작(둘 다 사용자에게 다시 묻지 않음).
  const [linkDecision, setLinkDecision] = useState<'yes' | 'no' | null>(null);
  const [linkConfirm, setLinkConfirm] = useState<{ value: string; dontAskAgain: boolean } | null>(null);
  const { remember, suggestionsFor } = useRecentInputs('todo-title');

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title || '');
    setDueDate(todo.dueDate ? format(todo.dueDate, 'yyyy-MM-dd') : '');
    setMemo(todo.memo || '');
    setPriority(todo.priority || null);
    setFolderId(todo.folderId || null);
    setLinkDecision(todo.dueDate ? (todo.linkedEventId ? 'yes' : 'no') : null);
  }, [todo]);

  const notifyFn = notify || (() => {});

  // 저장/삭제 결과를 기다리지 않고 즉시 닫는다(낙관적 UI) - 캘린더 일정 모달과 동일한 방식.
  // overridePriority: 색깔원 탭 시 setState가 아직 반영되기 전이라도 그 값으로 바로 저장하기 위함.
  const save = (overridePriority?: string | null) => {
    if (!title.trim()) return;
    const t = title.trim();
    const d = dueDate;
    const m = memo;
    const p = overridePriority !== undefined ? overridePriority : priority;
    const f = folderId;
    // 날짜가 있는데 아직 연동 여부를 결정 못한 경우(예: 자동완성으로 값이 채워진 경우) 안전하게 연동 안 함으로 처리
    const skipLink = !!d && linkDecision !== 'yes';
    remember(t);

    if (!isEdit) {
      onClose();
      api.todos.create({ title: t, completed: false, dueDate: d ? new Date(d).toISOString() : null, memo: m, priority: p, folderId: f, skipLink })
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
      skipLink,
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
    // 기한을 (다시) 설정하면 급한 정도에 따라 색깔원을 자동으로 골라줌 (빠른추가와 동일한 규칙)
    const autoPriority = autoPriorityForDueDate(value);
    if (autoPriority) setPriority(autoPriority);

    if (!value) {
      setDueDate('');
      setLinkDecision(null);
      return;
    }

    // 이미 날짜가 있던 할일의 날짜를 조정하는 경우(연동 여부는 이미 결정되어 있음) 다시 묻지 않음
    if (dueDate) {
      setDueDate(value);
      return;
    }

    // 처음으로 날짜를 설정하는 경우: 저장된 선호가 있으면 그대로 따르고, 없으면 물어봄
    const pref = typeof window !== 'undefined' ? window.localStorage.getItem(LINK_PREF_KEY) : null;
    setDueDate(value);
    if (pref === 'always') setLinkDecision('yes');
    else if (pref === 'never') setLinkDecision('no');
    else setLinkConfirm({ value, dontAskAgain: false });
  };

  const resolveLinkConfirm = (answer: 'yes' | 'no') => {
    if (linkConfirm?.dontAskAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(LINK_PREF_KEY, answer === 'yes' ? 'always' : 'never');
    }
    setLinkDecision(answer);
    setLinkConfirm(null);
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

          {/* 색깔원은 저장 버튼 바로 위: 색을 고르면 그 자리에서 바로 저장까지 됨(제목이 있을 때) */}
          <div className="flex items-center justify-center gap-4 py-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { const next = priority === p.key ? null : p.key; setPriority(next); save(next); }}
                title={p.key === 'red' ? '긴급' : p.key === 'yellow' ? '보통' : '여유'}
                className={`w-7 h-7 rounded-full ${p.dot} transition ${priority === p.key ? `ring-4 ring-offset-2 ring-offset-slate-900 ${p.ring} scale-110` : 'opacity-40 hover:opacity-80'}`}
              />
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            {isEdit && <button onClick={remove} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2/></button>}
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-400">취소</button>
            <button onClick={() => save()} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">{isEdit ? '저장' : '추가'}</button>
          </div>
        </div>
      </div>

      {linkConfirm && (
        <>
          <ModalBackCloseGuard onClose={() => setLinkConfirm(null)} />
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-2xl shadow-2xl p-5 space-y-4">
              <p className="text-sm font-bold text-white">일정으로도 저장할까요?</p>
              <p className="text-xs text-slate-400">이 날짜를 하루 종일 일정으로도 캘린더에 함께 저장할 수 있어요.</p>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={linkConfirm.dontAskAgain}
                  onChange={(e) => setLinkConfirm({ ...linkConfirm, dontAskAgain: e.target.checked })}
                  className="rounded"
                />
                다시 묻지 않기
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => resolveLinkConfirm('no')} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300">아니요</button>
                <button onClick={() => resolveLinkConfirm('yes')} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white">네</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
