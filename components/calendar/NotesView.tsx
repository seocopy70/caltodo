'use client';

import { useState } from 'react';
import { api } from '../../lib/api-client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, StickyNote, Archive, RotateCcw, Star, LayoutGrid, List } from 'lucide-react';
import NoteViewModal from './NoteViewModal';

export default function NotesView({ notes, user, onNotify, onRefresh, onNewNote, onEditNote, onPatchNote }: any) {
  const [showTrash, setShowTrash] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [viewingDeletedNote, setViewingDeletedNote] = useState<any>(null);
  const [layoutMode, setLayoutMode] = useState<'card' | 'title'>('card');

  const notify = onNotify || (() => {});
  const activeNotes = (notes || []).filter((n: any) => !n.deletedAt);
  const deletedNotes = (notes || []).filter((n: any) => !!n.deletedAt);

  const remove = (id: string) => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    api.notes.remove(id).then(() => { notify('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); }).catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };
  const restore = (id: string) => api.notes.restore(id).then(() => { notify('메모를 복원했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`복원 실패: ${err.message || err}`, 'error'));
  const purge = (id: string) => { if (!confirm('이 메모를 완전히 삭제할까요? 되돌릴 수 없습니다.')) return; api.notes.purge(id).then(() => { notify('메모를 완전히 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`완전 삭제 실패: ${err.message || err}`, 'error')); };
  const toggleStar = (note: any) => {
    onPatchNote?.(note.id, { showToday: !note.showToday });
    api.notes.update(note.id, { title: note.title, content: note.content, showToday: !note.showToday }).then(() => onRefresh?.());
  };

  return <div className="max-w-2xl mx-auto space-y-4 p-2">
    <div className="flex items-center gap-2">
      <button onClick={() => onNewNote?.()} className="flex-1 flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 shadow-xl text-slate-400 hover:border-blue-500/50 transition"><Plus className="w-5 h-5" /> 새 메모 작성</button>
      <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-1 shrink-0">
        <button onClick={() => setLayoutMode('card')} title="카드형" className={`p-2.5 rounded-xl ${layoutMode === 'card' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
        <button onClick={() => setLayoutMode('title')} title="제목 목록" className={`p-2.5 rounded-xl ${layoutMode === 'title' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
      </div>
    </div>

    {activeNotes.length === 0 && <div className="text-center text-slate-500 py-16 text-sm">작성된 메모가 없어요.</div>}

    {layoutMode === 'card' ? (
      <div className="columns-1 sm:columns-2 gap-3 [column-fill:_balance]">
        {activeNotes.map((note: any) => (
          <div key={note.id} onClick={() => setViewingNote(note)} className="break-inside-avoid mb-3 group relative bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 hover:border-blue-500/50 transition cursor-pointer">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h4 className="font-bold text-base truncate flex items-center gap-1.5"><StickyNote className="w-4 h-4 text-amber-400 shrink-0" />{note.title}</h4>
              <div className="flex items-center gap-1 shrink-0">
                <button title={note.showToday ? '오늘 탭에서 숨기기' : '오늘 탭에 표시'} onClick={(e) => { e.stopPropagation(); toggleStar(note); }} className={`p-1 ${note.showToday ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}><Star className="w-3.5 h-3.5" fill={note.showToday ? 'currentColor' : 'none'} /></button>
                <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="text-slate-600 hover:text-rose-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <p className="text-sm text-slate-400 line-clamp-8 whitespace-pre-wrap leading-relaxed">{note.content}</p>
            {note.updatedAt && <p className="text-[10px] text-slate-600 mt-2">{format(note.updatedAt, 'M월 d일 HH:mm', { locale: ko })}</p>}
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-slate-700/40 overflow-hidden divide-y divide-slate-800">
        {activeNotes.map((note: any) => (
          <button key={note.id} onClick={() => setViewingNote(note)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-800/30 text-left">
            <StickyNote className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1 min-w-0 font-bold text-sm truncate">{note.title}</span>
            {note.showToday && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
            <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="text-slate-600 hover:text-rose-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
          </button>
        ))}
      </div>
    )}

    <section className="rounded-2xl border border-slate-700/40 overflow-hidden">
      <button onClick={() => setShowTrash(!showTrash)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 text-sm font-bold">
        <span className="flex items-center gap-2"><Archive className="w-4 h-4 text-slate-400" /> 삭제된 메모 보관함 ({deletedNotes.length})</span>
        <span>{showTrash ? '접기' : '펼치기'}</span>
      </button>
      {showTrash && <div className="divide-y divide-slate-800">
        {deletedNotes.length === 0 ? <div className="p-4 text-xs text-slate-500">보관된 메모가 없습니다.</div> : deletedNotes.map((note: any) => (
          <div key={note.id} className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setViewingDeletedNote(note)} className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold truncate">{note.title}</p>
              <p className="text-[11px] text-slate-500 truncate">{note.content}</p>
            </button>
            <button onClick={() => restore(note.id)} title="복원" className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg shrink-0"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={() => purge(note.id)} title="완전 삭제" className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>}
    </section>

    {viewingNote && <NoteViewModal note={viewingNote} editable onClose={() => setViewingNote(null)} onEdit={(n: any) => { setViewingNote(null); onEditNote?.(n); }} />}
    {viewingDeletedNote && <NoteViewModal note={viewingDeletedNote} editable={false} onClose={() => setViewingDeletedNote(null)} />}
  </div>;
}
