'use client';

import { useState } from 'react';
import { api } from '../../lib/api-client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, StickyNote, Archive, RotateCcw, Star, LayoutGrid, List, Folder, FolderPlus, Pencil, X, Lock, ChevronDown, Check } from 'lucide-react';
import NoteViewModal from './NoteViewModal';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import { getFolderColor } from '../../lib/folderColor';

export default function NotesView({ notes, folders = [], user, onNotify, onRefresh, onNewNote, onEditNote, onPatchNote }: any) {
  const [showTrash, setShowTrash] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [viewingDeletedNote, setViewingDeletedNote] = useState<any>(null);
  const [layoutMode, setLayoutMode] = useState<'card' | 'title'>('card');
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'none'>('all');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const notify = onNotify || (() => {});
  const allActiveNotes = (notes || []).filter((n: any) => !n.deletedAt);
  const deletedNotes = (notes || []).filter((n: any) => !!n.deletedAt);
  const activeNotes = activeFolderId === 'all'
    ? allActiveNotes
    : activeFolderId === 'none'
      ? allActiveNotes.filter((n: any) => !n.folderId)
      : allActiveNotes.filter((n: any) => n.folderId === activeFolderId);

  const currentFolderLabel = activeFolderId === 'all' ? '전체' : activeFolderId === 'none' ? '미분류' : (folders.find((f: any) => f.id === activeFolderId)?.name || '전체');
  const currentFolderColor = activeFolderId !== 'all' && activeFolderId !== 'none' ? getFolderColor(activeFolderId) : null;

  const remove = (id: string) => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    api.notes.remove(id).then(() => { notify('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };
  const restore = (id: string) => api.notes.restore(id).then(() => { notify('메모를 복원했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`복원 실패: ${err.message || err}`, 'error'));
  const purge = (id: string) => { if (!confirm('이 메모를 완전히 삭제할까요? 되돌릴 수 없습니다.')) return; api.notes.purge(id).then(() => { notify('메모를 완전히 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`완전 삭제 실패: ${err.message || err}`, 'error')); };
  const toggleStar = (note: any) => {
    onPatchNote?.(note.id, { showToday: !note.showToday });
    api.notes.update(note.id, { title: note.title, content: note.content, showToday: !note.showToday, folderId: note.folderId || null }).then(() => onRefresh?.());
  };
  const assignFolder = (note: any, folderId: string | null) => {
    onPatchNote?.(note.id, { folderId });
    api.notes.update(note.id, { title: note.title, content: note.content, showToday: note.showToday, folderId }).then(() => onRefresh?.());
  };
  const toggleLine = (note: any, idx: number) => {
    const newContent = toggleChecklistLine(note.content, idx);
    onPatchNote?.(note.id, { content: newContent });
    api.notes.update(note.id, { title: note.title, content: newContent, showToday: note.showToday, folderId: note.folderId || null, format: note.format, locked: note.locked, lockType: note.lockType, lockHash: note.lockHash }).then(() => onRefresh?.());
  };

  const addFolder = () => {
    const name = prompt('새 폴더 이름을 입력하세요.');
    if (!name || !name.trim()) return;
    api.noteFolders.create(name.trim()).then(() => { notify('폴더가 생성되었습니다.'); onRefresh?.(); }).catch((err: any) => notify(`폴더 생성 실패: ${err.message || err}`, 'error'));
  };
  const renameFolder = (folder: any) => {
    const name = prompt('폴더 이름 변경', folder.name);
    if (!name || !name.trim() || name.trim() === folder.name) return;
    api.noteFolders.rename(folder.id, name.trim()).then(() => onRefresh?.()).catch((err: any) => notify(`이름 변경 실패: ${err.message || err}`, 'error'));
  };
  const removeFolder = (folder: any) => {
    if (!confirm(`"${folder.name}" 폴더를 삭제할까요? 폴더 안의 메모는 삭제되지 않고 '미분류'로 이동합니다.`)) return;
    if (activeFolderId === folder.id) setActiveFolderId('all');
    api.noteFolders.remove(folder.id).then(() => { notify('폴더를 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };

  return <div className="max-w-2xl mx-auto space-y-4 p-2">
    <div className="flex items-center gap-2">
      <button onClick={() => onNewNote?.()} className="flex-1 flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-xl text-slate-500 dark:text-slate-400 hover:border-blue-500/50 transition"><Plus className="w-5 h-5" /> 새 메모</button>
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-1 shrink-0">
        <button onClick={() => setLayoutMode('card')} title="카드형" className={`p-2.5 rounded-xl ${layoutMode === 'card' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
        <button onClick={() => setLayoutMode('title')} title="제목 목록" className={`p-2.5 rounded-xl ${layoutMode === 'title' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
      </div>
    </div>

    {/* 현재 폴더 표시 + 누르면 전체 폴더 목록 팝업 (폴더가 늘어나도 깔끔하게 유지) */}
    <div className="relative">
      <button onClick={() => setFolderPickerOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold">
        <Folder className={`w-4 h-4 ${currentFolderColor ? currentFolderColor.text : 'text-slate-500'}`} />
        <span className={currentFolderColor ? currentFolderColor.text : 'text-slate-700 dark:text-slate-200'}>{currentFolderLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {folderPickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setFolderPickerOpen(false)} />
          <div className="absolute top-11 left-0 z-50 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 space-y-0.5">
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
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.activeBg}`} />
                    <span className={`truncate ${c.text}`}>{f.name}</span>
                  </button>
                  {activeFolderId === f.id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                  <button onClick={() => renameFolder(f)} title="이름 변경" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeFolder(f)} title="폴더 삭제" className="p-1.5 text-slate-400 hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
            <button onClick={() => { addFolder(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold text-blue-500 dark:text-blue-400"><FolderPlus className="w-4 h-4" /> 새 폴더</button>
          </div>
        </>
      )}
    </div>

    {activeNotes.length === 0 && <div className="text-center text-slate-500 py-16 text-sm">{activeFolderId === 'all' ? '작성된 메모가 없어요.' : '이 폴더에는 메모가 없어요.'}</div>}

    {layoutMode === 'card' ? (
      <div className="columns-1 sm:columns-2 gap-3 [column-fill:_balance]">
        {activeNotes.map((note: any) => {
          const folderColor = note.folderId ? getFolderColor(note.folderId) : null;
          const iconColorClass = note.locked ? 'text-slate-400' : (folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400');
          return (
          <div key={note.id} onClick={() => setViewingNote(note)} className="break-inside-avoid mb-3 group relative bg-white dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none hover:border-blue-500/50 transition cursor-pointer">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h4 className="font-bold text-base truncate flex items-center gap-1.5 text-slate-900 dark:text-white min-w-0">{note.locked ? <Lock className={`w-4 h-4 shrink-0 ${iconColorClass}`} /> : <StickyNote className={`w-4 h-4 shrink-0 ${iconColorClass}`} />}<span className="truncate">{note.locked ? '비밀 메모' : note.title}</span></h4>
              <div className="flex items-center gap-1 shrink-0">
                <button title={note.showToday ? '오늘 탭에서 숨기기' : '오늘 탭에 표시'} onClick={(e) => { e.stopPropagation(); toggleStar(note); }} className={`p-1 ${note.showToday ? 'text-amber-400' : 'text-slate-400 dark:text-slate-600 hover:text-amber-400'}`}><Star className="w-3.5 h-3.5" fill={note.showToday ? 'currentColor' : 'none'} /></button>
                <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="text-slate-400 dark:text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {note.locked ? (
              <p className="text-sm text-slate-400 dark:text-slate-600 italic">잠긴 메모예요. 탭해서 잠금을 해제하세요.</p>
            ) : (
              <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-8 leading-relaxed min-w-0">
                <NoteContent content={note.content} format={note.format} onToggleLine={(idx) => toggleLine(note, idx)} />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 mt-2">
              {note.updatedAt && <p className="text-[10px] text-slate-400 dark:text-slate-600 shrink-0">{format(note.updatedAt, 'M월 d일 HH:mm', { locale: ko })}</p>}
              {folders.length > 0 && (
                <select
                  onClick={(e) => e.stopPropagation()}
                  value={note.folderId || ''}
                  onChange={(e) => assignFolder(note, e.target.value || null)}
                  className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value="">미분류</option>
                  {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
            </div>
          </div>
          );
        })}
      </div>
    ) : (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/40 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-transparent">
        {activeNotes.map((note: any) => {
          const folderColor = note.folderId ? getFolderColor(note.folderId) : null;
          const iconColorClass = note.locked ? 'text-slate-400' : (folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400');
          return (
          <button key={note.id} onClick={() => setViewingNote(note)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-left">
            {note.locked ? <Lock className={`w-4 h-4 shrink-0 ${iconColorClass}`} /> : <StickyNote className={`w-4 h-4 shrink-0 ${iconColorClass}`} />}
            <span className="flex-1 min-w-0 font-bold text-sm truncate text-slate-900 dark:text-white">{note.locked ? '비밀 메모' : note.title}</span>
            {note.showToday && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
            <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="text-slate-400 dark:text-slate-600 hover:text-rose-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
          </button>
          );
        })}
      </div>
    )}

    <section className="rounded-2xl border border-slate-200 dark:border-slate-700/40 overflow-hidden">
      <button onClick={() => setShowTrash(!showTrash)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800/40 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-2"><Archive className="w-4 h-4 text-slate-500 dark:text-slate-400" /> 삭제된 메모 보관함 ({deletedNotes.length})</span>
        <span>{showTrash ? '접기' : '펼치기'}</span>
      </button>
      {showTrash && <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-transparent">
        {deletedNotes.length === 0 ? <div className="p-4 text-xs text-slate-500">보관된 메모가 없습니다.</div> : deletedNotes.map((note: any) => (
          <div key={note.id} className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setViewingDeletedNote(note)} className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold truncate text-slate-900 dark:text-white">{note.title}</p>
              <p className="text-[11px] text-slate-500 truncate">{note.content}</p>
            </button>
            <button onClick={() => restore(note.id)} title="복원" className="p-2 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg shrink-0"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={() => purge(note.id)} title="완전 삭제" className="p-2 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>}
    </section>

    {viewingNote && <NoteViewModal note={viewingNote} editable onClose={() => setViewingNote(null)} onEdit={(n: any) => { setViewingNote(null); onEditNote?.(n); }} onToggleLine={toggleLine} />}
    {viewingDeletedNote && <NoteViewModal note={viewingDeletedNote} editable={false} onClose={() => setViewingDeletedNote(null)} />}
  </div>;
}
