'use client';

import { useState } from 'react';

const PATTERN_DOTS = Array.from({ length: 9 }, (_, i) => i);

export function PinInput({ label, onSubmit, submitLabel = '확인' }: { label?: string; onSubmit: (code: string) => void; submitLabel?: string }) {
  const [pin, setPin] = useState('');
  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-slate-500">{label}</p>}
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder="4~6자리 숫자"
        className="w-full text-center tracking-[0.5em] text-lg bg-slate-100 dark:bg-slate-800 rounded-xl py-3 outline-none"
      />
      <button
        disabled={pin.length < 4}
        onClick={() => onSubmit(pin)}
        className="w-full py-2.5 bg-blue-600 disabled:opacity-40 text-white rounded-xl font-bold text-sm"
      >
        {submitLabel}
      </button>
    </div>
  );
}

export function PatternInput({ label, onSubmit, submitLabel = '확인' }: { label?: string; onSubmit: (code: string) => void; submitLabel?: string }) {
  const [sequence, setSequence] = useState<number[]>([]);

  const tapDot = (i: number) => {
    if (sequence.includes(i)) return;
    setSequence((prev) => [...prev, i]);
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-slate-500">{label}</p>}
      <div className="grid grid-cols-3 gap-3 w-40 mx-auto">
        {PATTERN_DOTS.map((i) => {
          const order = sequence.indexOf(i);
          const active = order !== -1;
          return (
            <button
              key={i}
              onClick={() => tapDot(i)}
              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-bold transition ${active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}
            >
              {active ? order + 1 : '•'}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setSequence([])} className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl">다시 그리기</button>
        <button
          disabled={sequence.length < 4}
          onClick={() => onSubmit(sequence.join('-'))}
          className="flex-[2] py-2 bg-blue-600 disabled:opacity-40 text-white rounded-xl font-bold text-sm"
        >
          {submitLabel}
        </button>
      </div>
      <p className="text-[10px] text-slate-500 text-center">점 4개 이상을 순서대로 눌러 패턴을 만드세요.</p>
    </div>
  );
}
