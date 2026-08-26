'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, Archive, Lock } from 'lucide-react';
import { hashCode } from '../../lib/noteLock';
import { PinInput, PatternInput } from './NoteLockPad';
import NoteContent from './NoteContent';

export default function NoteViewModal({ note, editable = true, onClose, onEdit, onToggleLine }: any) {
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState(false);
  const isLocked = !!note.locked && !unlocked;

  const tryUnlock = async (code: string) => {
    const hash = await hashCode(code);
    if (hash === note.lockHash) { setUnlocked(true); setUnlockError(false); }
    else { setUnlockError(true); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="font-bold text-xl text-slate-900 dark:text-white truncate pr-3 flex items-center gap-2">{note.locked && <Lock className="w-4 h-4 text-slate-400 shrink-0" />}{isLocked ? '비밀 메모' : note.title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full shrink-0"><X /></button>
        </div>

        {isLocked ? (
          <div className="p-6 flex-1 flex flex-col items-center justify-center gap-3">
            <Lock className="w-8 h-8 text-slate-400" />
            <p className="text-sm text-slate-500">{note.lockType === 'pattern' ? '패턴을 그려서 잠금을 해제하세요.' : 'PIN 번호를 입력해서 잠금을 해제하세요.'}</p>
            <div className="w-full max-w-xs">
              {note.lockType === 'pattern' ? <PatternInput onSubmit={tryUnlock} submitLabel="잠금 해제" /> : <PinInput onSubmit={tryUnlock} submitLabel="잠금 해제" />}
            </div>
            {unlockError && <p className="text-xs text-rose-500">맞지 않아요. 다시 시도해주세요.</p>}
          </div>
        ) : (
          <div
            onClick={() => editable && onEdit?.(note)}
            className={`p-6 overflow-y-auto flex-1 text-lg leading-relaxed text-slate-800 dark:text-slate-100 ${editable && note.format !== 'checklist' ? 'cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/20' : ''}`}
          >
            {note.content
              ? <NoteContent content={note.content} format={note.format} onToggleLine={onToggleLine ? (idx) => onToggleLine(note, idx) : undefined} />
              : <span className="text-slate-400 dark:text-slate-600">내용이 없습니다.</span>}
          </div>
        )}

        {!isLocked && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-500">
            {!editable && <span className="flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> 보관함 (읽기 전용)</span>}
            {editable && note.updatedAt && <span>{format(note.updatedAt, 'yyyy년 M월 d일 HH:mm', { locale: ko })} 수정됨</span>}
            {editable && <span className="text-blue-500 dark:text-blue-400">탭하면 수정할 수 있어요</span>}
          </div>
        )}
      </div>
    </div>
  );
}
