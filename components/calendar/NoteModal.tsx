'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import { X, Trash2, ListChecks, ListOrdered, AlignLeft, Plus, Star } from 'lucide-react';
import { convertContentForFormat } from './NoteContent';
import { useModalBackClose } from '../../lib/useModalBackClose';
import { useRecentInputs } from '../../lib/useRecentInputs';

type NoteFormat = 'plain' | 'checklist' | 'numbered';

/** 구글 검색창처럼 최근 입력값을 입력창 아래에 후보로 보여주는 작은 재사용 UI. */
function AutocompleteDropdown({ suggestions, onSelect }: { suggestions: string[]; onSelect: (v: string) => void }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(s)}
          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 truncate"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function NoteModal({ note, folders = [], secureFolderId, initialFocus, initialLineIndex, onClose, onRefresh, onNotify }: any) {
  useModalBackClose(onClose);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showToday, setShowToday] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [format, setFormat] = useState<NoteFormat>('plain');
  const notify = onNotify || (() => {});
  const isEdit = !!note;
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const lineInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const isInSecureFolder = !!secureFolderId && folderId === secureFolderId;
  const [titleSuggestOpen, setTitleSuggestOpen] = useState(false);
  const { remember: rememberTitle, suggestionsFor: titleSuggestionsFor } = useRecentInputs('note-title');

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setShowToday(!!note?.showToday);
    setFolderId(note?.folderId || null);
    setFormat((note?.format as NoteFormat) || 'plain');
  }, [note]);

  // 어디를 탭해서 들어왔는지에 따라 제목이 아니라 실제 탭한 위치(내용)에 커서를 둠
  useEffect(() => {
    const t = setTimeout(() => {
      if (initialFocus === 'content') {
        if (format === 'plain') {
          contentRef.current?.focus();
          const len = contentRef.current?.value.length || 0;
          contentRef.current?.setSelectionRange(len, len);
        } else if (initialLineIndex != null) {
          lineInputRefs.current[initialLineIndex]?.focus();
        }
      } else {
        titleRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // 엔터키를 누르면 그 자리에서 줄을 나눠 새 항목을 만들고, 새 줄로 포커스 이동
  const insertLineAfter = (idx: number) => {
    const arr = [...lines];
    arr.splice(idx + 1, 0, format === 'checklist' ? '[ ] ' : '');
    setContent(arr.join('\n'));
    setTimeout(() => lineInputRefs.current[idx + 1]?.focus(), 0);
  };
  const removeLine = (idx: number) => { const arr = [...lines]; arr.splice(idx, 1); setContent(arr.join('\n')); };

  const toggleShowToday = (checked: boolean) => {
    if (isInSecureFolder) return; // 보안폴더 메모는 오늘 탭 표시(별표) 불가
    setShowToday(checked);
  };

  const handleFolderChange = (value: string) => {
    const next = value || null;
    setFolderId(next);
    if (next && next === secureFolderId) setShowToday(false); // 보안폴더로 옮기면 자동으로 별표 해제
  };

  const save = () => {
    if (!title.trim() && !content.trim()) return;
    const noteData = { title: title.trim() || '(제목 없음)', content, showToday: isInSecureFolder ? false : showToday, folderId, format };
    const targetId = note?.id;
    if (title.trim() && !isInSecureFolder) rememberTitle(title.trim()); // 보안폴더 메모 제목은 자동완성 기록에 남기지 않음
    onClose();
    const task = isEdit ? api.notes.update(targetId, noteData) : api.notes.create(noteData);
    task.then(() => { notify(isEdit ? '메모가 수정되었습니다.' : '메모가 추가되었습니다.'); onRefresh?.(); })
      .catch((err: any) => { console.error(err); notify(`저장 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  const remove = () => {
    if (!confirm('메모를 삭제하면 보관함으로 이동합니다. 계속할까요?')) return;
    const targetId = note.id;
    onClose();
    api.notes.remove(targetId).then(() => { notify('메모를 보관함으로 옮겼습니다.'); onRefresh?.(); })
      .catch((err: any) => { notify(`삭제 실패: ${err.message || err}`, 'error'); onRefresh?.(); });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 space-y-4 flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center shrink-0">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white">{isEdit ? '메모 수정' : '새 메모'}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
          </div>

          <div className="relative shrink-0">
            <input ref={titleRef} className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-200 dark:border-slate-700 pb-2 text-slate-900 dark:text-white" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setTitleSuggestOpen(true)} onBlur={() => setTimeout(() => setTitleSuggestOpen(false), 150)} />
            {titleSuggestOpen && !isInSecureFolder && <AutocompleteDropdown suggestions={titleSuggestionsFor(title)} onSelect={(v) => { setTitle(v); setTitleSuggestOpen(false); }} />}
          </div>

          {/* 형식: 일반/체크리스트/번호매김 중 하나만 선택 가능. 이미 만든 메모를 수정할 때는 형식이 바뀌면
              기존 체크 상태 등이 흐트러질 수 있어서, 새 메모를 만들 때만 고를 수 있게 함. */}
          {!isEdit && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => switchFormat('plain')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${format === 'plain' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><AlignLeft className="w-3.5 h-3.5" /> 일반</button>
              <button onClick={() => switchFormat('checklist')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${format === 'checklist' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><ListChecks className="w-3.5 h-3.5" /> 체크</button>
              <button onClick={() => switchFormat('numbered')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${format === 'numbered' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><ListOrdered className="w-3.5 h-3.5" /> 번호</button>
            </div>
          )}

          {format === 'plain' ? (
            <textarea ref={contentRef} className="w-full flex-1 min-h-[16rem] bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 outline-none text-base leading-relaxed resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="내용을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} />
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
                    <input
                      ref={(el) => { lineInputRefs.current[idx] = el; }}
                      value={text}
                      onChange={(e) => updateLine(idx, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertLineAfter(idx); } }}
                      className={`flex-1 bg-transparent outline-none text-base ${checked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-slate-100'}`}
                      placeholder="내용 (Enter로 다음 줄 추가)"
                    />
                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <button onClick={() => insertLineAfter(lines.length - 1)} className="flex items-center gap-1 text-xs font-bold text-blue-500 dark:text-blue-400 mt-1"><Plus className="w-3.5 h-3.5" /> 항목 추가</button>
            </div>
          )}

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => toggleShowToday(!showToday)}
              disabled={isInSecureFolder}
              className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg ${isInSecureFolder ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed' : showToday ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Star className="w-4 h-4" fill={showToday ? 'currentColor' : 'none'} /> 오늘 탭에 표시
            </button>
            {folders.length > 0 && (
              <select
                value={folderId || ''}
                onChange={(e) => handleFolderChange(e.target.value)}
                className="text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="">폴더 없음</option>
                {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}{f.id === secureFolderId ? ' 🔒' : ''}</option>)}
              </select>
            )}
          </div>
          {isInSecureFolder && <p className="text-[11px] text-slate-500 -mt-2">보안폴더로 옮긴 메모는 오늘 탭에 표시할 수 없어요.</p>}

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
