'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, Archive } from 'lucide-react';
import { useModalBackClose } from '../../lib/useModalBackClose';
import NoteContent from './NoteContent';

export default function NoteViewModal({ note, editable = true, onClose, onEdit, onToggleLine }: any) {
  useModalBackClose(onClose);

  // 제목을 탭했는지, 내용(및 몇 번째 줄)을 탭했는지에 따라 수정창에서 그 위치에 커서가 놓이도록 함
  const openEditAt = (focus: 'title' | 'content', lineIndex?: number) => editable && onEdit?.(note, focus, lineIndex);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 onClick={() => openEditAt('title')} className={`font-bold text-xl text-slate-900 dark:text-white truncate pr-3 ${editable ? 'cursor-text' : ''}`}>{note.title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full shrink-0"><X /></button>
        </div>

        <div
          onClick={() => note.format === 'plain' && openEditAt('content')}
          className={`p-6 overflow-y-auto flex-1 text-lg leading-relaxed text-slate-800 dark:text-slate-100 ${editable && note.format === 'plain' ? 'cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/20' : ''}`}
        >
          {note.content
            ? <NoteContent
                content={note.content}
                format={note.format}
                onToggleLine={onToggleLine ? (idx: number) => onToggleLine(note, idx) : undefined}
                onLineClick={(idx: number) => openEditAt('content', idx)}
              />
            : <span className="text-slate-400 dark:text-slate-600">내용이 없습니다.</span>}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-500">
          {!editable && <span className="flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> 보관함 (읽기 전용)</span>}
          {editable && note.updatedAt && <span>{format(note.updatedAt, 'yyyy년 M월 d일 HH:mm', { locale: ko })} 수정됨</span>}
          {editable && <span className="text-blue-500 dark:text-blue-400">탭하면 그 위치에서 수정할 수 있어요</span>}
        </div>
      </div>
    </div>
  );
}
