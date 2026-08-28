'use client';

import { useState } from 'react';
import { api } from '../../lib/api-client';
import { Folder, FolderPlus, Pencil, X, Check } from 'lucide-react';
import { getFolderColor } from '../../lib/folderColor';
import TodoListPanel from './TodoListPanel';

export default function TodoView({ todos, folders = [], user, onNotify, onRefresh, onPatchTodo, onRemoveTodo }: any) {
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'none'>('all');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const notify = onNotify || (() => {});

  const visibleTodos = activeFolderId === 'all'
    ? todos
    : activeFolderId === 'none'
      ? todos.filter((t: any) => !t.folderId)
      : todos.filter((t: any) => t.folderId === activeFolderId);

  const currentFolderLabel = activeFolderId === 'all' ? '전체' : activeFolderId === 'none' ? '미분류' : (folders.find((f: any) => f.id === activeFolderId)?.name || '전체');
  const currentFolderColor = activeFolderId !== 'all' && activeFolderId !== 'none' ? getFolderColor(activeFolderId) : null;

  const addFolder = () => {
    const name = prompt('새 폴더 이름을 입력하세요.');
    if (!name || !name.trim()) return;
    api.todoFolders.create(name.trim()).then(() => { notify('폴더가 생성되었습니다.'); onRefresh?.(); }).catch((err: any) => notify(`폴더 생성 실패: ${err.message || err}`, 'error'));
  };
  const renameFolder = (folder: any) => {
    const name = prompt('폴더 이름 변경', folder.name);
    if (!name || !name.trim() || name.trim() === folder.name) return;
    api.todoFolders.rename(folder.id, name.trim()).then(() => onRefresh?.()).catch((err: any) => notify(`이름 변경 실패: ${err.message || err}`, 'error'));
  };
  const removeFolder = (folder: any) => {
    if (!confirm(`"${folder.name}" 폴더를 삭제할까요? 폴더 안의 할일은 삭제되지 않고 '미분류'로 이동합니다.`)) return;
    if (activeFolderId === folder.id) setActiveFolderId('all');
    api.todoFolders.remove(folder.id).then(() => { notify('폴더를 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };

  return (
    <div className="max-w-2xl mx-auto p-2 space-y-2">
      <div className="relative shrink-0 w-fit">
        <button onClick={() => setFolderPickerOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold">
          <Folder className={`w-4 h-4 ${currentFolderColor ? currentFolderColor.text : 'text-slate-500'}`} />
          <span className={currentFolderColor ? currentFolderColor.text : ''}>{currentFolderLabel}</span>
        </button>
        {folderPickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setFolderPickerOpen(false)} />
            <div className="absolute top-12 left-0 z-50 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 space-y-0.5">
              <button onClick={() => { setActiveFolderId('all'); setFolderPickerOpen(false); }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold">
                <span>전체</span>{activeFolderId === 'all' && <Check className="w-4 h-4 text-blue-500" />}
              </button>
              <button onClick={() => { setActiveFolderId('none'); setFolderPickerOpen(false); }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold">
                <span>미분류</span>{activeFolderId === 'none' && <Check className="w-4 h-4 text-blue-500" />}
              </button>
              {folders.length > 0 && <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />}
              {folders.map((f: any) => {
                const c = getFolderColor(f.id);
                return (
                  <div key={f.id} className="w-full flex items-center gap-1 px-1 py-0.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    <button onClick={() => { setActiveFolderId(f.id); setFolderPickerOpen(false); }} className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm font-bold text-left min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-slate-300 dark:ring-slate-600 ${c.activeBg}`} />
                      <span className={`truncate ${c.text}`}>{f.name}</span>
                    </button>
                    {activeFolderId === f.id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                    <button onClick={() => renameFolder(f)} title="이름 변경" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeFolder(f)} title="폴더 삭제" className="p-1.5 text-slate-400 hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button onClick={addFolder} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold text-blue-500 dark:text-blue-400"><FolderPlus className="w-4 h-4" /> 새 폴더</button>
            </div>
          </>
        )}
      </div>

      <TodoListPanel
        todos={visibleTodos}
        folders={folders}
        defaultFolderId={activeFolderId !== 'all' && activeFolderId !== 'none' ? activeFolderId : null}
        user={user}
        onNotify={onNotify}
        onRefresh={onRefresh}
        onPatchTodo={onPatchTodo}
        onRemoveTodo={onRemoveTodo}
        showRelativeDates
      />
    </div>
  );
}
