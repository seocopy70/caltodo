'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, StickyNote, X } from 'lucide-react';
import { withTimeout } from '../../lib/withTimeout';

export default function NotesView({ notes, user, onNotify }: any) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const notify = onNotify || (() => {});

  const openNew = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setIsComposerOpen(true);
  };

  const openEdit = (note: any) => {
    setEditingNote(note);
    setTitle(note.title || '');
    setContent(note.content || '');
    setIsComposerOpen(true);
  };

  const close = () => {
    setIsComposerOpen(false);
    setEditingNote(null);
    setTitle('');
    setContent('');
  };

  // 저장/삭제 결과를 기다리지 않고 즉시 닫는다(낙관적 UI) - 다른 모달들과 동일한 방식.
  const save = () => {
    if (!title.trim() && !content.trim()) return;
    const targetId = editingNote?.id;
    const isEdit = !!editingNote;
    const noteData = {
      title: title.trim() || '(제목 없음)',
      content,
      userId: user.uid,
      updatedAt: Timestamp.now(),
      ...(isEdit ? {} : { createdAt: Timestamp.now() }),
    };
    close();

    const task: Promise<any> = isEdit
      ? updateDoc(doc(db, 'notes', targetId), noteData)
      : addDoc(collection(db, 'notes'), noteData);

    withTimeout(task)
      .then(() => notify(isEdit ? '메모가 수정되었습니다.' : '메모가 추가되었습니다.'))
      .catch((err: any) => {
        console.error(err);
        notify(`저장 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
      });
  };

  const remove = (id: string) => {
    if (!confirm('메모를 삭제할까요?')) return;
    withTimeout(deleteDoc(doc(db, 'notes', id)))
      .then(() => notify('메모가 삭제되었습니다.'))
      .catch((err: any) => {
        console.error(err);
        notify(`삭제 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
      });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-2">
      <button onClick={openNew} className="w-full flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 shadow-xl text-slate-400 hover:border-blue-500/50 transition">
        <Plus className="w-5 h-5" /> 새 메모 작성
      </button>

      {notes.length === 0 && (
        <div className="text-center text-slate-500 py-16 text-sm">작성된 메모가 없어요.</div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {notes.map((note: any) => (
          <div key={note.id} onClick={() => openEdit(note)} className="group relative bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 hover:border-blue-500/50 transition cursor-pointer">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h4 className="font-bold text-sm truncate flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />{note.title}</h4>
              <button onClick={(e) => { e.stopPropagation(); remove(note.id); }} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">{note.content}</p>
            {note.updatedAt && <p className="text-[10px] text-slate-600 mt-2">{format(note.updatedAt, 'M월 d일 HH:mm', { locale: ko })}</p>}
          </div>
        ))}
      </div>

      {isComposerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xl text-white">{editingNote ? '메모 수정' : '새 메모'}</h3>
                <button onClick={close} className="p-1 hover:bg-slate-800 rounded-full"><X /></button>
              </div>
              <input autoFocus className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-700 pb-2" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="w-full bg-slate-800 rounded-2xl p-3 outline-none text-sm h-40 resize-none" placeholder="내용을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="flex gap-3 pt-2">
                {editingNote && <button onClick={() => { remove(editingNote.id); close(); }} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2 /></button>}
                <button onClick={close} className="flex-1 py-3 font-bold text-slate-400">취소</button>
                <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
