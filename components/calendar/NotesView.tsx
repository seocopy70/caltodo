'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api-client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, StickyNote, Archive, RotateCcw, Star, LayoutGrid, List, Folder, FolderPlus, Pencil, X, ChevronDown, Check, ShieldCheck, ShieldOff, Lock, Search as SearchIcon } from 'lucide-react';
import NoteViewModal from './NoteViewModal';
import SecureFolderModal from './SecureFolderModal';
import FolderModal from './FolderModal';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import { getFolderColor } from '../../lib/folderColor';
import { ModalBackCloseGuard } from '../../lib/useModalBackClose';

export default function NotesView({ notes, folders = [], user, onNotify, onRefresh, onNewNote, onEditNote, onPatchNote }: any) {
  const [showTrash, setShowTrash] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [viewingDeletedNote, setViewingDeletedNote] = useState<any>(null);
  const [layoutMode, setLayoutMode] = useState<'card' | 'title'>('card');
  // 폰 좁은 화면(약 480px 이하)에서는 카드 2열보다 목록형이 읽기 편해서 기본값으로 사용.
  // 최초 마운트 시 1회만 화면 폭을 확인(이후 사용자가 직접 바꾸면 그 선택을 존중).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 480) setLayoutMode('title');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'none'>('all');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [secureModal, setSecureModal] = useState<{ folder: any; mode: 'setup' | 'unlock' | 'disable' } | null>(null);
  const [unlockedSecureId, setUnlockedSecureId] = useState<string | null>(null);
  const [secureSearchQuery, setSecureSearchQuery] = useState('');
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const toggleCardExpanded = (id: string) => setExpandedCardIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const notify = onNotify || (() => {});
  const secureFolder = folders.find((f: any) => f.isSecure) || null;

  const allActiveNotes = (notes || []).filter((n: any) => !n.deletedAt);
  const deletedNotes = (notes || []).filter((n: any) => !!n.deletedAt);
  // 보안폴더 메모는 '전체' 보기 등에서는 숨기고, 그 폴더를 잠금 해제하고 들어갔을 때만 보여줌
  const visibleForAll = secureFolder ? allActiveNotes.filter((n: any) => n.folderId !== secureFolder.id) : allActiveNotes;

  const isInUnlockedSecureFolder = activeFolderId === secureFolder?.id && unlockedSecureId === secureFolder?.id;
  const activeNotesBeforeSearch = activeFolderId === 'all'
    ? visibleForAll.filter((n: any) => !n.showToday) // 별표(오늘 탭 표시)된 메모는 전체보기에서 숨김 — 오늘 탭에서 확인
    : activeFolderId === 'none'
      ? visibleForAll.filter((n: any) => !n.folderId)
      : activeFolderId === secureFolder?.id
        ? (isInUnlockedSecureFolder ? allActiveNotes.filter((n: any) => n.folderId === secureFolder.id) : [])
        : visibleForAll.filter((n: any) => n.folderId === activeFolderId);
  // 보안폴더 안에서만 쓰는 로컬 검색(전역 검색은 보안폴더 메모를 애초에 제외하므로 별도로 둠)
  const secureQuery = secureSearchQuery.trim().toLowerCase();
  const activeNotes = isInUnlockedSecureFolder && secureQuery
    ? activeNotesBeforeSearch.filter((n: any) => `${n.title} ${n.content || ''}`.toLowerCase().includes(secureQuery))
    : activeNotesBeforeSearch;

  const currentFolderLabel = activeFolderId === 'all' ? '전체' : activeFolderId === 'none' ? '미분류' : (folders.find((f: any) => f.id === activeFolderId)?.name || '전체');
  const currentFolderColor = activeFolderId !== 'all' && activeFolderId !== 'none' ? getFolderColor(activeFolderId, folders) : null;
  const isViewingLockedSecure = activeFolderId === secureFolder?.id && unlockedSecureId !== secureFolder?.id;

  const remove = (id: string) => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    api.notes.remove(id).then(() => { notify('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };
  const restore = (id: string) => api.notes.restore(id).then(() => { notify('메모를 복원했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`복원 실패: ${err.message || err}`, 'error'));
  const purge = (id: string) => { if (!confirm('이 메모를 완전히 삭제할까요? 되돌릴 수 없습니다.')) return; api.notes.purge(id).then(() => { notify('메모를 완전히 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`완전 삭제 실패: ${err.message || err}`, 'error')); };
  const toggleStar = (note: any) => {
    if (secureFolder && note.folderId === secureFolder.id) return; // 보안폴더 메모는 별표 불가
    onPatchNote?.(note.id, { showToday: !note.showToday });
    api.notes.update(note.id, { title: note.title, content: note.content, showToday: !note.showToday, folderId: note.folderId || null }).catch((err: any) => { notify(`저장 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };
  const assignFolder = (note: any, folderId: string | null) => {
    const movingToSecure = !!secureFolder && folderId === secureFolder.id;
    onPatchNote?.(note.id, { folderId, ...(movingToSecure ? { showToday: false } : {}) });
    api.notes.update(note.id, { title: note.title, content: note.content, showToday: movingToSecure ? false : note.showToday, folderId }).catch((err: any) => { notify(`저장 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };
  const toggleLine = (note: any, idx: number) => {
    const newContent = toggleChecklistLine(note.content, idx);
    onPatchNote?.(note.id, { content: newContent });
    api.notes.update(note.id, { title: note.title, content: newContent, showToday: note.showToday, folderId: note.folderId || null, format: note.format }).catch((err: any) => { notify(`저장 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  const [folderModal, setFolderModal] = useState<{ mode: 'add' | 'rename'; folder?: any } | null>(null);
  const saveFolderModal = (name: string, color: string | null) => {
    if (folderModal?.mode === 'rename' && folderModal.folder) {
      const f = folderModal.folder;
      if (name === f.name && color === (f.color || null)) { setFolderModal(null); return; }
      api.noteFolders.rename(f.id, name, color).then(() => onRefresh?.()).catch((err: any) => notify(`저장 실패: ${err.message || err}`, 'error'));
    } else {
      api.noteFolders.create(name, color).then(() => { notify('폴더가 생성되었습니다.'); onRefresh?.(); }).catch((err: any) => notify(`폴더 생성 실패: ${err.message || err}`, 'error'));
    }
    setFolderModal(null);
  };
  const removeFolder = (folder: any) => {
    if (folder.isSecure) { notify('보안폴더는 먼저 해제한 뒤 삭제할 수 있어요.', 'error'); return; }
    if (!confirm(`"${folder.name}" 폴더를 삭제할까요? 폴더 안의 메모는 삭제되지 않고 '미분류'로 이동합니다.`)) return;
    if (activeFolderId === folder.id) setActiveFolderId('all');
    api.noteFolders.remove(folder.id).then(() => { notify('폴더를 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };

  const onSecureSuccess = () => {
    if (secureModal?.mode === 'unlock') setUnlockedSecureId(secureModal.folder.id);
    if (secureModal?.mode === 'disable') { setUnlockedSecureId(null); if (activeFolderId === secureModal.folder.id) setActiveFolderId('all'); }
    setSecureModal(null);
    onRefresh?.();
  };

  const selectFolder = (id: string | 'all' | 'none') => {
    // 보안폴더를 벗어나 다른 폴더로 이동하면 잠금 해제 상태를 초기화해서, 다시 들어올 때 비번을
    // 재확인하도록 함(같은 탭 안에서 폴더만 바꾸는 경우엔 컴포넌트가 그대로 유지되어 이전엔 안 풀렸었음).
    if (secureFolder && activeFolderId === secureFolder.id && id !== secureFolder.id) {
      setUnlockedSecureId(null);
    }
    setActiveFolderId(id);
    setFolderPickerOpen(false);
    setSecureSearchQuery('');
    if (secureFolder && id === secureFolder.id && unlockedSecureId !== secureFolder.id) {
      setSecureModal({ folder: secureFolder, mode: 'unlock' });
    }
  };

  return <div className="max-w-2xl mx-auto space-y-4 p-2">
    {/* 폴더(아이콘만) + 새 메모 + 카드/목록 토글을 한 줄로 */}
    <div className="flex items-center gap-2">
      <div className="relative shrink-0">
        <button onClick={() => setFolderPickerOpen(true)} title={currentFolderLabel} className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Folder className={`w-6 h-6 ${currentFolderColor ? currentFolderColor.text : 'text-slate-500'}`} />
        </button>
        {folderPickerOpen && (
          <>
            <ModalBackCloseGuard onClose={() => setFolderPickerOpen(false)} />
            <div className="fixed inset-0 z-40" onClick={() => setFolderPickerOpen(false)} />
            <div className="fixed top-28 left-2 z-50 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 space-y-0.5">
              <button onClick={() => selectFolder('all')} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold">
                <span>전체</span>{activeFolderId === 'all' && <Check className="w-4 h-4 text-blue-500" />}
              </button>
              <button onClick={() => selectFolder('none')} className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold">
                <span>미분류</span>{activeFolderId === 'none' && <Check className="w-4 h-4 text-blue-500" />}
              </button>
              {folders.length > 0 && <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />}
              {folders.map((f: any) => {
                const c = getFolderColor(f.id, folders);
                return (
                  <div key={f.id} className="w-full flex items-center gap-1 px-1 py-0.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                    <button onClick={() => selectFolder(f.id)} className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm font-bold text-left min-w-0">
                      {f.isSecure ? <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" /> : <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-slate-300 dark:ring-slate-600 ${c.activeBg}`} />}
                      <span className={`truncate ${c.text}`}>{f.name}</span>
                    </button>
                    {activeFolderId === f.id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                    {!f.isSecure && folders.filter((x: any) => !x.isSecure).length >= 0 && !secureFolder && (
                      <button onClick={() => setSecureModal({ folder: f, mode: 'setup' })} title="보안폴더로 지정" className="p-1.5 text-slate-400 hover:text-blue-500 shrink-0"><ShieldCheck className="w-3.5 h-3.5" /></button>
                    )}
                    {f.isSecure && (
                      <button onClick={() => setSecureModal({ folder: f, mode: 'disable' })} title="보안폴더 해제" className="p-1.5 text-slate-400 hover:text-rose-500 shrink-0"><ShieldOff className="w-3.5 h-3.5" /></button>
                    )}
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

      <button onClick={() => onNewNote?.()} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-xl text-slate-500 dark:text-slate-400 hover:border-blue-500/50 transition font-bold text-sm"><Plus className="w-5 h-5" /> 새 메모</button>

      <button onClick={() => setLayoutMode((m) => (m === 'card' ? 'title' : 'card'))} title={layoutMode === 'card' ? '제목 목록으로 보기' : '카드형으로 보기'} className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0 text-slate-500">
        {layoutMode === 'card' ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
      </button>
    </div>

    {isViewingLockedSecure ? (
      <div className="text-center text-slate-500 py-16 text-sm flex flex-col items-center gap-2">
        <Lock className="w-8 h-8 text-slate-300 dark:text-slate-700" />
        <span>보안폴더예요. 잠금을 해제해야 볼 수 있어요.</span>
        <button onClick={() => setSecureModal({ folder: secureFolder, mode: 'unlock' })} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">잠금 해제</button>
      </div>
    ) : <>
      {isInUnlockedSecureFolder && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            value={secureSearchQuery}
            onChange={(e) => setSecureSearchQuery(e.target.value)}
            placeholder="보안폴더 안에서 검색"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none text-sm"
          />
        </div>
      )}
      {activeNotes.length === 0 && <div className="text-center text-slate-500 py-16 text-sm">{secureQuery ? '검색 결과가 없어요.' : activeFolderId === 'all' ? '작성된 메모가 없어요.' : '이 폴더에는 메모가 없어요.'}</div>}

      {layoutMode === 'card' ? (
        <div className="columns-2 gap-2 sm:gap-3 [column-fill:_balance]">
          {activeNotes.map((note: any) => {
            const folderColor = note.folderId ? getFolderColor(note.folderId, folders) : null;
            const isSecureNote = !!secureFolder && note.folderId === secureFolder.id;
            const iconColorClass = folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400';
            return (
              <div key={note.id} onClick={() => onEditNote?.(note, 'content')} className="break-inside-avoid mb-2 sm:mb-3 group relative bg-white dark:bg-slate-800/30 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none hover:border-blue-500/50 transition cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 onClick={(e) => { e.stopPropagation(); onEditNote?.(note, 'title'); }} className="font-bold text-lg truncate flex items-center gap-1.5 text-slate-900 dark:text-white min-w-0 cursor-text"><StickyNote className={`w-4 h-4 shrink-0 ${iconColorClass}`} /><span className="truncate">{note.title}</span></h4>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isSecureNote && <button title={note.showToday ? '오늘 탭에서 숨기기' : '오늘 탭에 표시'} onClick={(e) => { e.stopPropagation(); toggleStar(note); }} className={`p-1 ${note.showToday ? 'text-amber-400' : 'text-slate-400 dark:text-slate-600 hover:text-amber-400'}`}><Star className="w-3.5 h-3.5" fill={note.showToday ? 'currentColor' : 'none'} /></button>}
                    <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="text-slate-400 dark:text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="text-base text-slate-600 dark:text-slate-400 leading-relaxed min-w-0">
                  {(() => {
                    const contentLines = (note.content || '').split('\n');
                    const isLong = contentLines.length > 15;
                    const isExpanded = expandedCardIds.has(note.id);
                    const shown = isLong && !isExpanded ? contentLines.slice(0, 15).join('\n') : note.content;
                    return (
                      <>
                        <NoteContent content={shown} format={note.format} onToggleLine={(idx) => toggleLine(note, idx)} onLineClick={(idx: number) => onEditNote?.(note, 'content', idx)} />
                        {isLong && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCardExpanded(note.id); }}
                            className="mt-1 text-xs font-bold text-blue-500 dark:text-blue-400"
                          >
                            {isExpanded ? '접기' : `더 보기 (${contentLines.length - 15}줄 더)`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
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
                      {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}{f.isSecure ? ' 🔒' : ''}</option>)}
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
            const folderColor = note.folderId ? getFolderColor(note.folderId, folders) : null;
            const iconColorClass = folderColor ? folderColor.text : 'text-amber-500 dark:text-amber-400';
            return (
              <button key={note.id} onClick={() => setViewingNote(note)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-left">
                <StickyNote className={`w-4 h-4 shrink-0 ${iconColorClass}`} />
                <span className="flex-1 min-w-0 font-bold text-base truncate text-slate-900 dark:text-white">{note.title}</span>
                {note.showToday && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
                <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="text-slate-400 dark:text-slate-600 hover:text-rose-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </button>
            );
          })}
        </div>
      )}
    </>}

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

    {viewingNote && <NoteViewModal note={viewingNote} editable onClose={() => setViewingNote(null)} onEdit={(n: any, focus?: 'title' | 'content', lineIndex?: number) => { setViewingNote(null); onEditNote?.(n, focus, lineIndex); }} onToggleLine={toggleLine} />}
    {viewingDeletedNote && <NoteViewModal note={viewingDeletedNote} editable={false} onClose={() => setViewingDeletedNote(null)} />}
    {secureModal && <SecureFolderModal folder={secureModal.folder} mode={secureModal.mode} onClose={() => setSecureModal(null)} onSuccess={onSecureSuccess} onNotify={notify} />}
    {folderModal && <FolderModal folder={folderModal.mode === 'rename' ? folderModal.folder : null} onSave={saveFolderModal} onClose={() => setFolderModal(null)} />}
  </div>;
}
