'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { api } from '../../lib/api-client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, StickyNote, Archive, RotateCcw, Star, LayoutGrid, List, Folder, FolderPlus, Pencil, X, ChevronDown, Check, ShieldCheck, ShieldOff, Lock, Search as SearchIcon } from 'lucide-react';
import NoteViewModal from './NoteViewModal';
import SecureFolderModal from './SecureFolderModal';
import FolderModal from './FolderModal';
import NoteContent, { toggleChecklistLine } from './NoteContent';
import { getFolderColor } from '../../lib/folderColor';
import { ModalBackCloseGuard, isAnyModalOpen } from '../../lib/useModalBackClose';


function SearchHighlightedText({ text, query, matchBase = 0, matchRefs, matchKeyPrefix = '', activeMatchIndex = -1 }: {
  text: string;
  query: string;
  matchBase?: number;
  matchRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  matchKeyPrefix?: string;
  activeMatchIndex?: number;
}) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(query);
  let localMatch = 0;
  while (index !== -1) {
    if (index > cursor) parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, index)}</span>);
    const matchIndex = matchBase + localMatch;
    const refKey = `${matchKeyPrefix}:${matchIndex}`;
    parts.push(
      <mark
        key={`m-${index}`}
        ref={(el) => { matchRefs.current[refKey] = el; }}
        className={`bg-amber-300 dark:bg-amber-500/60 text-inherit rounded px-0.5 ${activeMatchIndex === matchIndex ? 'ring-2 ring-amber-500' : 'ring-2 ring-transparent'}`}
      >
        {text.slice(index, index + query.length)}
      </mark>
    );
    cursor = index + query.length;
    localMatch += 1;
    index = lower.indexOf(query, cursor);
  }
  if (cursor < text.length) parts.push(<span key={`t-end-${cursor}`}>{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

function secureMatchCount(text: string, query: string) {
  if (!query) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  let index = lower.indexOf(query);
  while (index !== -1) {
    count += 1;
    index = lower.indexOf(query, index + Math.max(1, query.length));
  }
  return count;
}

function SecureSearchContent({ content, format, query, noteId, activeMatchIndex, matchRefs, onToggleLine, snippetOnly = false }: {
  content: string;
  format?: string;
  query: string;
  noteId: string;
  activeMatchIndex: number;
  matchRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  onToggleLine?: (idx: number) => void;
  snippetOnly?: boolean;
}) {
  const allLines = (content || '').split('\n');
  let lines = allLines;
  let lineStartOffset = 0;
  if (snippetOnly && query) {
    let seen = 0;
    let activeLine = 0;
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i] || '';
      const prefix = format === 'checklist' ? (line.match(/^\[( |x)\]\s?/i)?.[0]?.length || 0) : 0;
      const count = secureMatchCount(line.slice(prefix), query);
      if (activeMatchIndex < seen + count) { activeLine = i; break; }
      seen += count;
    }
    lineStartOffset = Math.max(0, activeLine - 1);
    lines = allLines.slice(lineStartOffset, Math.min(allLines.length, lineStartOffset + 3));
  }
  const prefixLengths = format === 'checklist'
    ? lines.map((line) => {
        const m = line.match(/^\[( |x)\]\s?/i);
        return m ? m[0].length : 0;
      })
    : lines.map(() => 0);
  const contentMatchOffset = (lineIndex: number) => {
    const line = lines[lineIndex] || '';
    const prefix = prefixLengths[lineIndex] || 0;
    const visibleText = line.slice(prefix);
    const before = visibleText.toLowerCase().indexOf(query);
    if (before < 0) return 0;
    let count = 0;
    for (let i = 0; i < lineIndex; i++) {
      count += secureMatchCount(lines[i].slice(prefixLengths[i] || 0), query);
    }
    if (snippetOnly) {
      for (let i = 0; i < lineStartOffset; i++) {
        count += secureMatchCount(allLines[i].slice(format === 'checklist' ? (allLines[i].match(/^\[( |x)\]\s?/i)?.[0]?.length || 0) : 0), query);
      }
    }
    return count;
  };

  if (format === 'checklist') {
    return (
      <div className="break-words [overflow-wrap:anywhere]">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          const m = line.match(/^\[( |x)\]\s?(.*)$/i);
          const checked = m ? m[1].toLowerCase() === 'x' : false;
          const text = m ? m[2] : line;
          const base = contentMatchOffset(i);
          return (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleLine?.(i); }}
                className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-400 dark:border-slate-500'}`}
              >
                {checked && <span className="text-white text-[10px] leading-none">✓</span>}
              </button>
              <span className={`min-w-0 ${checked ? 'line-through text-slate-400 dark:text-slate-600' : ''}`}>
                <SearchHighlightedText text={text} query={query} matchBase={base} matchRefs={matchRefs} matchKeyPrefix={noteId} activeMatchIndex={activeMatchIndex} />
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (format === 'numbered') {
    let n = 0;
    return (
      <div className="break-words [overflow-wrap:anywhere]">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          n++;
          const base = contentMatchOffset(i);
          return (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="shrink-0 font-bold opacity-60">{n}.</span>
              <span className="min-w-0">
                <SearchHighlightedText text={line} query={query} matchBase={base} matchRefs={matchRefs} matchKeyPrefix={noteId} activeMatchIndex={activeMatchIndex} />
              </span>
            </div>
          );
        })}
      </div>
    );
  }