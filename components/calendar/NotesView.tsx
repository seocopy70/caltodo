'use client';

import { useState } from 'react';
import { api } from '../../lib/api-client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, StickyNote, X, Archive, RotateCcw, Star } from 'lucide-react';

export default function NotesView({ notes, user, onNotify, onRefresh }: any) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const notify = onNotify || (() => {});
  const activeNotes = (notes || []).filter((n: any) => !n.deletedAt);
  const deletedNotes = (notes || []).filter((n: any) => !!n.deletedAt);

  const openNew = () => { setEditingNote(null); setTitle(''); setContent(''); setIsComposerOpen(true); };
  const openEdit = (note: any) => { setEditingNote(note); setTitle(note.title || ''); setContent(note.content || ''); setIsComposerOpen(true); };
  const close = () => { setIsComposerOpen(false); setEditingNote(null); setTitle(''); setContent(''); };

  const save = () => {
    if (!title.trim() && !content.trim()) return;
    const targetId = editingNote?.id;
    const isEdit = !!editingNote;
    const noteData = { title: title.trim() || '(제목 없음)', content, showToday: editingNote?.showToday || false };
    close();
    const task = isEdit ? api.notes.update(targetId, noteData) : api.notes.create(noteData);
    task.then(() => { notify(isEdit ? '메모가 수정되었습니다.' : '메모가 추가되었습니다.'); onRefresh?.(); })
      .catch((err: any) => { console.error(err); notify(`저장 실패: ${err.message || err}`, 'error'); });
  };

  const remove = (id: string) => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    api.notes.remove(id).then(() => { notify('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); })
      .catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };
  const restore = (id: string) => api.notes.restore(id).then(() => { notify('메모를 복원했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`복원 실패: ${err.message || err}`, 'error'));
  const purge = (id: string) => { if (!confirm('이 메모를 완전히 삭제할까요? 되돌릴 수 없습니다.')) return; api.notes.purge(id).then(() => { notify('메모를 완전히 삭제했습니다.'); onRefresh?.(); }).catch((err: any) => notify(`완전 삭제 실패: ${err.message || err}`, 'error')); };
  const toggleToday = (id: string) => api.notes.restore ? api.notes.update(id, { ...activeNotes.find((n: any) => n.id === id), showToday: !activeNotes.find((n: any) => n.id === id)?.showToday }) : null;

  return <div className="max-w-2xl mx-auto space-y-4 p-2">
    <button onClick={openNew} className="w-full flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 shadow-xl text-slate-400 hover:border-blue-500/50 transition"><Plus className="w-5 h-5" /> 새 메모 작성</button>

    {activeNotes.length === 0 && <div className="text-center text-slate-500 py-16 text-sm">작성된 메모가 없어요.</div>}

    <div className="grid sm:grid-cols-2 gap-3">
      {activeNotes.map((note: any) => (
        <div key={note.id} onClick={() => openEdit(note)} className="group relative bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 hover:border-blue-500/50 transition cursor-pointer">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className="font-bold text-sm truncate flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />{note.title}</h4>
            <div className="flex items-center gap-1">
              <button title={note.showToday ? '오늘 탭에서 숨기기' : '오늘 탭에 표시'} onClick={(e) => { e.stopPropagation(); api.notes.update(note.id, { title: note.title, content: note.content, showToday: !note.showToday }).then(onRefresh); }} className={`p-1 ${note.showToday ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}><Star className="w-3.5 h-3.5" fill={note.showToday ? 'currentColor' : 'none'} /></button>
              <button title="보관함으로 이동" onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">{note.content}</p>
          {note.updatedAt && <p className="text-[10px] text-slate-600 mt-2">{format(note.updatedAt, 'M월 d일 HH:mm', { locale: ko })}</p>}
        </div>
      ))}
    </div>

    <section className="rounded-2xl border border-slate-700/40 overflow-hidden">
      <button onClick={() => setShowTrash(!showTrash)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 text-sm font-bold"><span className="flex items-center gap-2"><Archive className="w-4 h-4 text-slate-400" /> 삭제된 메모 보관함 ({deletedNotes.length})</span><span>{showTrash ? '접기' : '펼치기'}</span></button>
      {showTrash && <div className="divide-y divide-slate-800">{deletedNotes.length === 0 ? <div className="p-4 text-xs text-slate-500">보관된 메모가 없습니다.</div> : deletedNotes.map((note: any) => <div key={note.id} className="flex items-center gap-3 px-4 py-3"><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{note.title}</p><p className="text-[11px] text-slate-500 truncate">{note.content}</p></div><button onClick={() => restore(note.id)} title="복원" className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><RotateCcw className="w-4 h-4" /></button><button onClick={() => purge(note.id)} title="완전 삭제" className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
    </section>

    {isComposerOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"><div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"><div className="p-6 space-y-4"><div className="flex justify-between items-center"><h3 className="font-bold text-xl text-white">{editingNote ? '메모 수정' : '새 메모'}</h3><button onClick={close} className="p-1 hover:bg-slate-800 rounded-full"><X /></button></div><input autoFocus className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-700 pb-2" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} /><textarea className="w-full bg-slate-800 rounded-2xl p-3 outline-none text-sm h-40 resize-none" placeholder="내용을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} /><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={editingNote?.showToday || false} onChange={(e) => setEditingNote((n: any) => ({ ...(n || {}), showToday: e.target.checked }))} /> 오늘 탭에 표시</label><div className="flex gap-3 pt-2">{editingNote && <button onClick={() => { remove(editingNote.id); close(); }} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2 /></button>}<button onClick={close} className="flex-1 py-3 font-bold text-slate-400">취소</button><button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button></div></div></div></div>}
  </div>;
}
