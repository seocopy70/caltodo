'use client';

import { useEffect, useRef, useState } from 'react';
import { format, isToday } from 'date-fns';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, GripVertical, Trash2, Folder } from 'lucide-react';
import { api } from '../../lib/api-client';
import { autoPriorityForDueDate } from '../../lib/todoAutoColor';
import { ModalBackCloseGuard } from '../../lib/useModalBackClose';
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

function dueDateLabel(due: Date, showRelative: boolean): { text: string; isNear: boolean } {
  if (!showRelative) return { text: format(due, 'M/d'), isNear: isToday(due) };
  const today = new Date();
  const diffDays = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diffDays === 0) return { text: '오늘', isNear: true };
  if (diffDays === 1) return { text: '내일', isNear: true };
  return { text: format(due, 'M/d'), isNear: false };
}

export default function TodoListPanel({
  todos,
  folders = [],
  user,
  onNotify,
  onRefresh,
  onPatchTodo,
  onRemoveTodo,
  maxVisible,
  compact = false,
  hideCompleted = false,
  largePlaceholder = false,
  showRelativeDates = false,
}: any) {
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const [quickActionsFor, setQuickActionsFor] = useState<any>(null);
  const [folderPickerFor, setFolderPickerFor] = useState<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const notify = onNotify || (() => {});

  const activeTodosSorted = todos.filter((t: any) => !t.completed).sort(sortActive);
  const activeTodos = previewOrder
    ? (previewOrder.map((id) => activeTodosSorted.find((t: any) => t.id === id)).filter(Boolean) as any[])
    : activeTodosSorted;
  const completedTodos = todos
    .filter((t: any) => t.completed)
    .sort((a: any, b: any) => {
      const at = a.completedAt?.getTime?.() ?? a.createdAt?.getTime?.() ?? 0;
      const bt = b.completedAt?.getTime?.() ?? b.createdAt?.getTime?.() ?? 0;
      return bt - at;
    });

  const visibleTodos = maxVisible && !expanded ? activeTodos.slice(0, maxVisible) : activeTodos;

  const toggleTodo = (id: string, completed: boolean) => {
    onPatchTodo?.(id, { completed, completedAt: completed ? new Date() : null });
    // 이미 로컬 상태에 낙관적으로 반영했으므로, 성공 시엔 전체 재조회가 불필요 — 실패했을 때만 되돌림.
    api.todos.update(id, { completed })
      .catch((err: any) => { notify(`업데이트 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  const removeTodo = (id: string) => {
    if (!confirm('삭제할까요?')) return;
    onRemoveTodo?.(id);
    api.todos.remove(id)
      .then(() => notify('할 일이 삭제되었습니다.'))
      .catch((err: any) => { notify(`삭제 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  // 포인터(터치+마우스 공용) 기반 드래그 재정렬. 손잡이를 짧게 탭하면(움직임 거의 없으면)
  // 드래그 대신 색깔/날짜/폴더를 바로 바꿀 수 있는 빠른 메뉴를 연다.
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const startDrag = (id: string, e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragMovedRef.current = false;
    setDragId(id);
    setPreviewOrder(activeTodosSorted.map((t: any) => t.id));
  };

  useEffect(() => {
    if (!dragId) return;
    const DRAG_THRESHOLD = 6; // px — 이보다 적게 움직이면 "탭"으로 간주
    const handleMove = (e: PointerEvent) => {
      if (dragStartPos.current) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragMovedRef.current = true;
      }
      if (!dragMovedRef.current) return; // 아직 "탭"일 수 있으니 미리보기 순서를 흔들지 않음
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest?.('[data-todo-id]') as HTMLElement | null;
      if (!row) return;
      const overId = row.getAttribute('data-todo-id');
      if (!overId || overId === dragId) return;
      setPreviewOrder((prev) => {
        if (!prev) return prev;
        const from = prev.indexOf(dragId);
        const to = prev.indexOf(overId);
        if (from < 0 || to < 0 || from === to) return prev;
        const next = [...prev];
        next.splice(from, 1);
        next.splice(to, 0, dragId);
        return next;
      });
    };
    const handleUp = async () => {
      const wasDrag = dragMovedRef.current;
      const tappedId = dragId;
      const finalOrder = previewOrder;
      setDragId(null);
      if (!wasDrag) {
        // 움직이지 않고 뗐으면 드래그가 아니라 탭 — 빠른 메뉴(색깔/날짜/폴더)를 연다
        setPreviewOrder(null);
        const t = todos.find((x: any) => x.id === tappedId);
        if (t) setQuickActionsFor(t);
        return;
      }
      if (!finalOrder) return;
      finalOrder.forEach((id, i) => onPatchTodo?.(id, { orderIndex: i }));
      try {
        await Promise.all(finalOrder.map((id, i) => api.todos.update(id, { orderIndex: i })));
      } catch {
        onRefresh?.();
      } finally {
        setPreviewOrder(null);
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  const applyQuickAction = (extra: any) => {
    if (!quickActionsFor) return;
    const id = quickActionsFor.id;
    onPatchTodo?.(id, extra);
    api.todos.update(id, extra).catch((err: any) => { notify(`업데이트 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  // 폴더 아이콘 전용 메뉴(색깔/날짜 없이 폴더만) — quickActionsFor(색/날짜/폴더 통합 메뉴)와는 별개의 진입점
  const applyFolderChange = (folderId: string | null) => {
    if (!folderPickerFor) return;
    const id = folderPickerFor.id;
    onPatchTodo?.(id, { folderId });
    api.todos.update(id, { folderId }).catch((err: any) => { notify(`업데이트 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
    setFolderPickerFor(null);
  };

  return (
    <section className={`rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 overflow-hidden ${compact ? '' : 'shadow-sm dark:shadow-xl'}`}>
      {maxVisible && activeTodos.length > 0 && (
        <button onClick={() => setExpanded((v) => !v)} title={expanded ? '접기' : `펼치기 (${activeTodos.length})`} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-700/40 text-xs font-bold text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
          {!expanded && <span>{activeTodos.length}</span>}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      <div ref={listRef} className={`divide-y divide-slate-100 dark:divide-slate-700/30 ${maxVisible && expanded ? 'max-h-[50vh] overflow-y-auto' : ''}`}>
        {visibleTodos.map((todo: any) => (
          <div
            key={todo.id}
            data-todo-id={todo.id}
            className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition ${dragId === todo.id ? 'opacity-40' : ''}`}
          >
            <CheckButton priority={todo.priority} onClick={() => toggleTodo(todo.id, true)} />
            <div onClick={() => setEditingTodo(todo)} className="flex-1 min-w-0 cursor-pointer flex items-center gap-3">
              <span className="text-base font-medium truncate text-slate-900 dark:text-slate-100">{todo.title}</span>
              {todo.dueDate && (() => { const d = dueDateLabel(todo.dueDate, showRelativeDates); return <span className={`text-base font-medium shrink-0 ${d.isNear ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400'}`}>{d.text}</span>; })()}
            </div>
            <button onClick={() => setFolderPickerFor(todo)} className="text-slate-400 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition shrink-0 flex items-center gap-1 max-w-[6.5rem]" title="폴더 선택">
              <Folder className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-xs truncate">{folders.find((f: any) => f.id === todo.folderId)?.name || '미분류'}</span>
            </button>
            <button onClick={() => removeTodo(todo.id)} className="text-slate-400 dark:text-slate-600 hover:text-rose-500 transition shrink-0" title="삭제">
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); startDrag(todo.id, e); }}
              className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
              title="누른 채로 끌면 순서 변경, 짧게 탭하면 빠른 메뉴"
            >
              <GripVertical className="w-6 h-6" />
            </button>
          </div>
        ))}
      </div>

      {activeTodos.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-600">할 일이 없습니다.</div>}

      {!hideCompleted && completedTodos.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700/40">
          <button onClick={() => setShowCompleted((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            {showCompleted ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4 rotate-90" />}
            완료됨 <span className="bg-slate-100 dark:bg-slate-700 px-1.5 rounded">{completedTodos.length}</span>
          </button>
          {showCompleted && (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/20 opacity-70 dark:opacity-55">
              {completedTodos.map((todo: any) => (
                <div key={todo.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleTodo(todo.id, false)} className="shrink-0"><CheckCircle2 className="w-5 h-5 text-blue-500" /></button>
                  <div onClick={() => setEditingTodo(todo)} className="flex-1 min-w-0 cursor-pointer flex items-center gap-3">
                    <span className="text-base line-through text-slate-500 truncate">{todo.title}</span>
                    {todo.completedAt && <span className="text-base text-slate-500 shrink-0">{format(todo.completedAt, 'M/d')}</span>}
                  </div>
                  <button onClick={() => removeTodo(todo.id)} className="text-slate-300 dark:text-slate-700 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingTodo && <TodoModal todo={editingTodo} folders={folders} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={onRefresh} />}
      {quickActionsFor && (
        <>
          <ModalBackCloseGuard onClose={() => setQuickActionsFor(null)} />
          <div className="fixed inset-0 z-40" onClick={() => setQuickActionsFor(null)} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} />
          <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-3" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-200">{quickActionsFor.title}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12 shrink-0">색깔</span>
              {PRIORITIES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => { applyQuickAction({ priority: quickActionsFor.priority === p.key ? null : p.key }); setQuickActionsFor(null); }}
                  className={`w-6 h-6 rounded-full ${p.dot} transition ${quickActionsFor.priority === p.key ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${p.ring}` : 'opacity-50 hover:opacity-90'}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12 shrink-0">날짜</span>
              <input
                type="date"
                defaultValue={quickActionsFor.dueDate ? format(quickActionsFor.dueDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const autoPriority = autoPriorityForDueDate(e.target.value);
                  applyQuickAction({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null, ...(autoPriority ? { priority: autoPriority } : {}) });
                  setQuickActionsFor(null);
                }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none"
              />
            </div>
            {folders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-12 shrink-0">폴더</span>
                <select
                  defaultValue={quickActionsFor.folderId || ''}
                  onChange={(e) => { applyQuickAction({ folderId: e.target.value || null }); setQuickActionsFor(null); }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none"
                >
                  <option value="">미분류</option>
                  {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => setQuickActionsFor(null)} className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300">닫기</button>
          </div>
        </>
      )}

      {folderPickerFor && (
        <>
          <ModalBackCloseGuard onClose={() => setFolderPickerFor(null)} />
          <div className="fixed inset-0 z-40" onClick={() => setFolderPickerFor(null)} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} />
          <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-2" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-200 mb-1">{folderPickerFor.title}</p>
            <button
              onClick={() => applyFolderChange(null)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold ${!folderPickerFor.folderId ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              미분류
            </button>
            {folders.map((f: any) => (
              <button
                key={f.id}
                onClick={() => applyFolderChange(f.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold ${folderPickerFor.folderId === f.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
