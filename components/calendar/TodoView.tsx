'use client';

import { useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import { Folder, FolderPlus, Pencil, X, Check, Plus } from 'lucide-react';
import { getFolderColor } from '../../lib/folderColor';
import { ModalBackCloseGuard, isAnyModalOpen } from '../../lib/useModalBackClose';
import TodoListPanel from './TodoListPanel';
import TodoModal from './TodoModal';
import FolderModal from './FolderModal';

export default function TodoView({ todos, folders = [], user, onNotify, onRefresh, onPatchTodo, onRemoveTodo, onAddTodo, onReconcileTodo, onSwipeHint }: any) {
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'none'>('all');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [isNewTodoOpen, setIsNewTodoOpen] = useState(false);
  const notify = onNotify || (() => {});

  // 화면 맨 위에서 시작해 아래로 스와이프하면 다음 폴더로 이동(전체 → 폴더들 → 미분류 → 전체).
  // "맨 위에서 시작"만 인정해서, 목록을 위로 스크롤하려는 일반적인 손짓과 섞이지 않게 함.
  const folderSwipeStart = useRef<{ x: number; y: number; atTop: boolean } | null>(null);
  const handleFolderSwipeStart = (e: React.TouchEvent) => {
    const doc = (document.scrollingElement || document.documentElement) as HTMLElement;
    folderSwipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, atTop: doc.scrollTop <= 1 };
  };
  const handleFolderSwipeEnd = (e: React.TouchEvent) => {
    const start = folderSwipeStart.current;
    folderSwipeStart.current = null;
    if (!start || !start.atTop || isAnyModalOpen()) return; // 할일 입력창 등 모달이 열려있으면 그 안의 스크롤이 폴더 전환으로 이어지지 않게 함
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaY) < Math.abs(deltaX) * 1.5) return; // 세로로 뚜렷하게 밀 때만
    if (deltaY < 60) return; // 아래로 60px 이상(위로 미는 건 그냥 스크롤로 둠)
    const cycle: Array<string> = ['all', ...folders.map((f: any) => f.id), 'none'];
    const idx = cycle.indexOf(activeFolderId);
    const next = cycle[(idx + 1 + cycle.length) % cycle.length];
    setActiveFolderId(next as any);
    const label = next === 'all' ? '전체' : next === 'none' ? '미분류' : (folders.find((f: any) => f.id === next)?.name || '');
    onSwipeHint?.(`📁 ${label}`);
  };

  const visibleTodos = activeFolderId === 'all'
    ? todos
    : activeFolderId === 'none'
      ? todos.filter((t: any) => !t.folderId)
      : todos.filter((t: any) => t.folderId === activeFolderId);

  const currentFolderLabel = activeFolderId === 'all' ? '전체' : activeFolderId === 'none' ? '미분류' : (folders.find((f: any) => f.id === activeFolderId)?.name || '전체');
  const currentFolderColor = activeFolderId !== 'all' && activeFolderId !== 'none' ? getFolderColor(activeFolderId, folders) : null;
  const composerFolderId = activeFolderId !== 'all' && activeFolderId !== 'none' ? activeFolderId : null;

  const [folderModal, setFolderModal] = useState<{ mode: 'add' | 'rename'; folder?: any } | null>(null);
  const saveFolderModal = (name: string, color: string | null) => {
    if (folderModal?.mode === 'rename' && folderModal.folder) {
      const f = folderModal.folder;
      if (name === f.name && color === (f.color || null)) { setFolderModal(null); return; }
      api.todoFolders.rename(f.id, name, color).then(() => onRefresh?.()).catch((err: any) => notify(`저장 실패: ${err.message || err}`, 'error'));
    } else {
      api.todoFolders.create(name, color).then(() => { notify('폴더가 생성되었습니다.'); onRefresh?.(); }).catch((err: any) => notify(`폴더 생성 실패: ${err.message || err}`, 'error'));
    }
    setFolderModal(null);
  };
  const removeFolder = (folder: any) => {
    if (!confirm(`"${folder.name}" 폴더를 삭제할까요? 폴더 안의 할일은 삭제되지 않고 '미분류'로 이동합니다.`)) return;
    if (activeFolderId === folder.id) setActiveFolderId('all');
    api.todoFolders.remove(folder.id).then(() => { notify('폴더를 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };

  return (
    <div className="max-w-2xl mx-auto p-2 space-y-2" onTouchStart={handleFolderSwipeStart} onTouchEnd={handleFolderSwipeEnd}>
      {/* 메모탭 상단과 동일한 레이아웃: 새 할일 버튼 + 폴더(아이콘만, 오른쪽) */}
      <div className="flex items-center gap-2">
        <button onClick={() => setIsNewTodoOpen(true)} className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-xl text-slate-500 dark:text-slate-400 hover:border-blue-500/50 transition font-bold text-sm"><Plus className="w-5 h-5" /> 새 할일</button>

        <div className="relative shrink-0">
          <button onClick={() => setFolderPickerOpen(true)} title={currentFolderLabel} className="px-2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
            <Folder className={`w-5 h-5 ${currentFolderColor ? currentFolderColor.text : 'text-slate-500'}`} />
          </button>
          {folderPickerOpen && (
            <>
              <ModalBackCloseGuard onClose={() => setFolderPickerOpen(false)} />
              <div className="fixed inset-0 z-40" onClick={() => setFolderPickerOpen(false)} onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} />
              <div className="fixed top-28 right-2 z-50 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 space-y-0.5" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                <button onClick={() => { setActiveFolderId('all'); setFolderPickerOpen(false); }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold">
                  <span>전체</span>{activeFolderId === 'all' && <Check className="w-4 h-4 text-blue-500" />}
                </button>
                <button onClick={() => { setActiveFolderId('none'); setFolderPickerOpen(false); }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold">
                  <span>미분류</span>{activeFolderId === 'none' && <Check className="w-4 h-4 text-blue-500" />}
                </button>
                {folders.length > 0 && <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />}
                {folders.map((f: any) => {
                  const c = getFolderColor(f.id, folders);
                  return (
                    <div key={f.id} className="w-full flex items-center gap-1 px-1 py-0.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                      <button onClick={() => { setActiveFolderId(f.id); setFolderPickerOpen(false); }} className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm font-bold text-left min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-slate-300 dark:ring-slate-600 ${c.activeBg}`} />
                        <span className={`truncate ${c.text}`}>{f.name}</span>
                      </button>
                      {activeFolderId === f.id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                      <button onClick={() => setFolderModal({ mode: 'rename', folder: f })} title="이름 변경" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeFolder(f)} title="폴더 삭제" className="p-1.5 text-slate-400 hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button onClick={() => setFolderModal({ mode: 'add' })} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold text-blue-500 dark:text-blue-400"><FolderPlus className="w-4 h-4" /> 새 폴더</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 실제로 만들어져 있는 폴더만 이름이 있는 색깔버튼으로 보여줘서 탭 한 번으로 그 폴더만 보기 */}
      {folders.length > 0 && (
        <div className="flex items-center justify-end gap-1.5 overflow-x-auto px-1 pb-0.5">
          {folders.map((f: any) => {
            const c = getFolderColor(f.id, folders);
            const active = activeFolderId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFolderId(active ? 'all' : f.id)}
                title={f.name}
                className={`shrink-0 px-2.5 py-1 rounded-lg transition text-xs font-bold truncate max-w-[6rem] ${active ? `${c.activeBg} text-white` : `${c.bg} ${c.text}`}`}
              >
                {f.name}
              </button>
            );
          })}
          <button
            onClick={() => setActiveFolderId('all')}
            title="전체"
            className={`shrink-0 px-2.5 py-1 rounded-lg transition text-xs font-bold ${activeFolderId === 'all' ? 'bg-slate-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
          >
            전체
          </button>
        </div>
      )}

      <TodoListPanel
        todos={visibleTodos}
        folders={folders}
        defaultFolderId={composerFolderId}
        user={user}
        onNotify={onNotify}
        onRefresh={onRefresh}
        onPatchTodo={onPatchTodo}
        onRemoveTodo={onRemoveTodo}
        showRelativeDates
      />

      {isNewTodoOpen && <TodoModal todo={null} folders={folders} defaultFolderId={composerFolderId} notify={notify} onClose={() => setIsNewTodoOpen(false)} onRefresh={onRefresh} onAddLocal={onAddTodo} onReconcileLocal={onReconcileTodo} />}
      {folderModal && <FolderModal folder={folderModal.mode === 'rename' ? folderModal.folder : null} onSave={saveFolderModal} onClose={() => setFolderModal(null)} />}
    </div>
  );
}
