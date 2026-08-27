'use client';

export default function NoteContent({ content, format, onToggleLine, onLineClick, className }: { content: string; format?: string; onToggleLine?: (idx: number) => void; onLineClick?: (idx: number) => void; className?: string }) {
  const lines = (content || '').split('\n');
  // 공백/줄바꿈 없는 긴 문자열(URL 등)이 카드/화면 폭을 넘어가지 않도록 어디서든 줄바꿈 허용
  const wrapClass = 'break-words [overflow-wrap:anywhere]';

  if (format === 'checklist') {
    return (
      <div className={className}>
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          const m = line.match(/^\[( |x)\]\s?(.*)$/i);
          const checked = m ? m[1].toLowerCase() === 'x' : false;
          const text = m ? m[2] : line;
          return (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleLine?.(i); }}
                className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-400 dark:border-slate-500'}`}
              >
                {checked && <span className="text-white text-[10px] leading-none">✓</span>}
              </button>
              <span onClick={(e) => { e.stopPropagation(); onLineClick?.(i); }} className={`min-w-0 ${wrapClass} ${checked ? 'line-through text-slate-400 dark:text-slate-600' : ''}`}>{text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (format === 'numbered') {
    let n = 0;
    return (
      <div className={className}>
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          n++;
          return (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="shrink-0 font-bold opacity-60">{n}.</span>
              <span onClick={(e) => { e.stopPropagation(); onLineClick?.(i); }} className={`min-w-0 ${wrapClass}`}>{line}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return <p onClick={(e) => { e.stopPropagation(); onLineClick?.(0); }} className={`whitespace-pre-wrap min-w-0 ${wrapClass} ${className || ''}`}>{content}</p>;
}

/** 체크리스트 형식 메모의 특정 줄 체크 상태를 토글한 새 content 문자열을 반환 */
export function toggleChecklistLine(content: string, idx: number): string {
  const lines = (content || '').split('\n');
  const line = lines[idx] ?? '';
  const m = line.match(/^\[( |x)\]\s?(.*)$/i);
  if (m) {
    const checked = m[1].toLowerCase() === 'x';
    lines[idx] = `[${checked ? ' ' : 'x'}] ${m[2]}`;
  } else {
    lines[idx] = `[x] ${line}`;
  }
  return lines.join('\n');
}

/** 형식 전환 시 기존 내용을 새 형식에 맞게 변환(체크리스트 마커 추가/제거) */
export function convertContentForFormat(content: string, fromFormat: string, toFormat: string): string {
  const lines = (content || '').split('\n');
  if (toFormat === 'checklist' && fromFormat !== 'checklist') {
    return lines.map((l) => (/^\[( |x)\]/i.test(l) || !l.trim() ? l : `[ ] ${l}`)).join('\n');
  }
  if (fromFormat === 'checklist' && toFormat !== 'checklist') {
    return lines.map((l) => l.replace(/^\[( |x)\]\s?/i, '')).join('\n');
  }
  return content;
}
