'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useModalBackClose } from '../../lib/useModalBackClose';
import { PALETTE_KEYS, getColorByKey } from '../../lib/folderColor';

/**
 * 폴더 새로 만들기/이름 변경에 공통으로 쓰는 입력창.
 * - 이름 입력 + 색깔원 10개(5개씩 보이고 좌우로 넘기면 나머지 5개)
 * - 색깔원을 고르면(이름이 있을 때) 그 자리에서 바로 저장됨
 */
export default function FolderModal({ folder, onSave, onClose }: { folder?: any; onSave: (name: string, color: string | null) => void; onClose: () => void }) {
  useModalBackClose(onClose);
  const [name, setName] = useState(folder?.name || '');
  const [color, setColor] = useState<string | null>(folder?.color || null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commit = (nextColor?: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) { inputRef.current?.focus(); return; }
    onSave(trimmed, nextColor !== undefined ? nextColor : color);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">{folder ? '폴더 이름 변경' : '새 폴더'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <input
          ref={inputRef}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none text-slate-900 dark:text-slate-100"
          placeholder="폴더 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
        <div>
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {PALETTE_KEYS.map((key) => {
              const c = getColorByKey(key);
              const selected = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setColor(key); commit(key); }}
                  title={key}
                  className={`w-7 h-7 rounded-full shrink-0 transition ${c.dot} ${selected ? 'ring-4 ring-slate-900 dark:ring-white scale-110' : 'opacity-40 hover:opacity-80'}`}
                />
              );
            })}
          </div>
        </div>
        <button onClick={() => commit()} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm">저장</button>
      </div>
    </div>
  );
}
