'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { X, Trash2 } from 'lucide-react';

export default function NoteModal({ note, folders = [], onClose, onRefresh, onNotify }: any) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showToday, setShowToday] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const notify = onNotify || (() => {});
  const isEdit = !!note;

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setShowToday(!!note?.showToday);
    setFolderId(note?.folderId || null);
  }, [note]);

  const save = () => {
    if (!title.trim() && !content.trim()) return;
    const noteData = { title: title.trim() || '(제목 없음)', content, showToday, folderId };
    const targetId = note?.id;
    onClose();
    const task = isEdit ? api.notes.update(targetId, noteData) : api.notes.create(noteData);
    task.then(() => { notify(isEdit ? '메모가 수정되었습니다.' : '메모가 추가되었습니다.'); onRefresh?.(); })
      .catch((err: any) => { console.error(err); notify(`저장 실패: ${err.message || err}`, 'error'); });
  };

  const remove = () => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    const targetId = note.id;
    onClose();
    api.notes.remove(targetId).then(() => { notify('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); })
      .catch((err: any) => notify(`삭제 실패: ${err.message || err}`, 'error'));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 space-y-4 flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center shrink-0">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white">{isEdit ? '메모 수정' : '새 메모'}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
          </div>
          <input autoFocus className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-200 dark:border-slate-700 pb-2 shrink-0 text-slate-900 dark:text-white" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="w-full flex-1 min-h-[16rem] bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 outline-none text-base leading-relaxed resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="내용을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} /> 오늘 탭에 표시</label>
            {folders.length > 0 && (
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="">폴더 없음</option>
                {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-3 pt-2 shrink-0">
            {isEdit && <button onClick={remove} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2 /></button>}
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 dark:text-slate-400">취소</button>
            <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
