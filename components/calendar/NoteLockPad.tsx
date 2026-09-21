'use client';

import { useState, useEffect, useRef } from 'react';

const PATTERN_DOTS = Array.from({ length: 9 }, (_, i) => i);

export function PinInput({ label, onSubmit, submitLabel = '확인', autoSubmit = false }: { label?: string; onSubmit: (code: string) => void; submitLabel?: string; autoSubmit?: boolean }) {
  const [pin, setPin] = useState('');

  // 기존 PIN을 입력해서 해제하는 화면(autoSubmit=true)에서는, 버튼을 따로 안 눌러도
  // 입력이 끝나면 바로 제출되게 한다. PIN 자릿수는 폴더마다 달라(4~6자리) 몇 자리에서
  // 끝날지 미리 알 수 없으므로: 최대 길이(6)에 도달하면 즉시, 그보다 짧으면 타이핑을
  // 잠깐 멈췄을 때(0.5초) 제출한다. onSubmit은 매 렌더마다 새 함수로 넘어올 수 있어
  // ref로 최신 값만 참조하고, 같은 값으로는 한 번만 제출하도록 막는다(오답 시 무한 재시도 방지).
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoSubmit || pin.length < 4 || firedForRef.current === pin) return;
    if (pin.length >= 6) {
      firedForRef.current = pin;
      onSubmitRef.current(pin);
      return;
    }
    const timer = setTimeout(() => {
      firedForRef.current = pin;
      onSubmitRef.current(pin);
    }, 500);
    return () => clearTimeout(timer);
  }, [pin, autoSubmit]);

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-slate-500">{label}</p>}
      <input
        autoFocus
        // type="password"를 쓰면 크롬 등 브라우저가 "비밀번호를 저장할까요?" 팝업을 띄우는 경우가 있어서,
        // 실제로는 text 필드에 -webkit-text-security로 점(dot) 마스킹만 흉내내고 자동완성/암호관리자 감지를 끔.
        type="text"
        style={{ WebkitTextSecurity: 'disc' } as any}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        name="cal2do-secure-code"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
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
