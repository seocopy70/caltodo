'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { X, Trash2, ListChecks, ListOrdered, AlignLeft, Plus, Lock } from 'lucide-react';
import { hashCode } from '../../lib/noteLock';
import { convertContentForFormat } from './NoteContent';
import { PinInput, PatternInput } from './NoteLockPad';

type NoteFormat = 'plain' | 'checklist' | 'numbered';

export default function NoteModal({ note, folders = [], onClose, onRefresh, onNotify }: any) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showToday, setShowToday] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [format, setFormat] = useState<NoteFormat>('plain');
  const [locked, setLocked] = useState(false);
  const [lockType, setLockType] = useState<'pin' | 'pattern'>('pin');
  const [lockHash, setLockHash] = useState<string | null>(null); // 기존 잠금 해시(변경 안 하면 유지)
  const [settingUpLock, setSettingUpLock] = useState(false); // 새 PIN/패턴 설정 중
  const notify = onNotify || (() => {});
  const isEdit = !!note;

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setShowToday(!!note?.showToday);
    setFolderId(note?.folderId || null);
    setFormat((note?.format as NoteFormat) || 'plain');
    setLocked(!!note?.locked);
    setLockType((note?.lockType as 'pin' | 'pattern') || 'pin');
    setLockHash(note?.lockHash || null);
    setSettingUpLock(false);
  }, [note]);

  const switchFormat = (next: NoteFormat) => {
    setContent((c) => convertContentForFormat(c, format, next));
    setFormat(next);
  };

  const lines = content.split('\n');
  const updateLine = (idx: number, text: string) => {
    const arr = [...lines];
    if (format === 'checklist') {
      const m = arr[idx]?.match(/^\[( |x)\]\s?/i);
      arr[idx] = `${m ? m[0] : '[ ] '}${text}`;
    } else {
      arr[idx] = text;
    }
    setContent(arr.join('\n'));
  };
  const toggleLineCheck = (idx: number) => {
    const arr = [...lines];
    const m = arr[idx]?.match(/^\[( |x)\]\s?(.*)$/i);
    if (m) { const checked = m[1].toLowerCase() === 'x'; arr[idx] = `[${checked ? ' ' : 'x'}] ${m[2]}`; }
    setContent(arr.join('\n'));
  };
  const addLine = () => setContent((c) => `${c}${c ? '\n' : ''}${format === 'checklist' ? '[ ] ' : ''}`);
  const removeLine = (idx: number) => { const arr = [...lines]; arr.splice(idx, 1); setContent(arr.join('\n')); };

  const setupLockCode = async (code: string) => {
    setLockHash(await hashCode(code));
    setSettingUpLock(false);
    notify(`${lockType === 'pin' ? 'PIN' : '패턴'}이 설정되었어요. 저장을 눌러 완료하세요.`);
  };

  const toggleLocked = (checked: boolean) => {
    setLocked(checked);
    if (checked && !lockHash) setSettingUpLock(true);
    if (!checked) { setLockHash(null); setSettingUpLock(false); }
  };

  const save = () => {
    if (!title.trim() && !content.trim()) return;
    if (locked && !lockHash) { notify('먼저 PIN 또는 패턴을 설정해주세요.', 'error'); return; }
    const noteData = { title: title.trim() || '(제목 없음)', content, showToday, folderId, format, locked, lockType: locked ? lockType : null, lockHash: locked ? lockHash : null };
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

          {/* 형식: 일반/체크리스트/번호매김 중 하나만 선택 가능 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => switchFormat('plain')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${format === 'plain' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><AlignLeft className="w-3.5 h-3.5" /> 일반</button>
            <button onClick={() => switchFormat('checklist')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${format === 'checklist' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><ListChecks className="w-3.5 h-3.5" /> 체크리스트</button>
            <button onClick={() => switchFormat('numbered')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${format === 'numbered' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><ListOrdered className="w-3.5 h-3.5" /> 번호매김</button>
          </div>

          {format === 'plain' ? (
            <textarea className="w-full flex-1 min-h-[16rem] bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 outline-none text-base leading-relaxed resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="내용을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} />
          ) : (
            <div className="w-full flex-1 min-h-[16rem] bg-slate-100 dark:bg-slate-800 rounded-2xl p-3 overflow-y-auto space-y-1.5">
              {lines.map((line, idx) => {
                const m = format === 'checklist' ? line.match(/^\[( |x)\]\s?(.*)$/i) : null;
                const checked = m ? m[1].toLowerCase() === 'x' : false;
                const text = m ? m[2] : line;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    {format === 'checklist' && (
                      <button onClick={() => toggleLineCheck(idx)} className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-400 dark:border-slate-500'}`}>{checked && <span className="text-white text-[10px] leading-none">✓</span>}</button>
                    )}
                    {format === 'numbered' && <span className="w-5 shrink-0 text-sm font-bold opacity-60 text-right">{idx + 1}.</span>}
                    <input value={text} onChange={(e) => updateLine(idx, e.target.value)} className={`flex-1 bg-transparent outline-none text-sm ${checked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-slate-100'}`} placeholder="내용" />
                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <button onClick={addLine} className="flex items-center gap-1 text-xs font-bold text-blue-500 dark:text-blue-400 mt-1"><Plus className="w-3.5 h-3.5" /> 항목 추가</button>
            </div>
          )}

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
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Lock className="w-3.5 h-3.5" /><input type="checkbox" checked={locked} onChange={(e) => toggleLocked(e.target.checked)} /> 비밀 메모(화면 가림)</label>
          </div>

          {locked && (
            <div className="shrink-0 bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-3 space-y-2">
              {!settingUpLock ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{lockHash ? `${lockType === 'pin' ? 'PIN' : '패턴'} 설정됨` : '아직 설정 안 됨'}</span>
                  <button onClick={() => setSettingUpLock(true)} className="text-xs font-bold text-blue-500 dark:text-blue-400">{lockHash ? '다시 설정' : '설정하기'}</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setLockType('pin')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${lockType === 'pin' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500'}`}>PIN 번호</button>
                    <button onClick={() => setLockType('pattern')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${lockType === 'pattern' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500'}`}>패턴</button>
                  </div>
                  {lockType === 'pin' ? <PinInput label="새 PIN 번호를 입력하세요" onSubmit={setupLockCode} submitLabel="PIN 설정" /> : <PatternInput label="새 패턴을 그려주세요" onSubmit={setupLockCode} submitLabel="패턴 설정" />}
                </>
              )}
              <p className="text-[10px] text-slate-500">비밀 메모는 다른 사람이 화면을 봐도 내용이 바로 보이지 않도록 가려주는 간단한 잠금이에요.</p>
            </div>
          )}

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
