'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useModalBackClose } from '../../lib/useModalBackClose';
import { getTodoEventLinkPref, setTodoEventLinkPref, type TodoEventLinkPref } from '../../lib/todoEventLinkPref';

const OPTIONS: { key: TodoEventLinkPref; label: string; desc: string }[] = [
  { key: 'ask', label: '매번 물어보기', desc: '할일에 날짜를 처음 설정할 때마다 "일정으로도 저장할까요?"라고 물어봐요.' },
  { key: 'always', label: '항상 일정에도 저장', desc: '날짜가 있는 할일은 물어보지 않고 항상 하루종일 일정으로도 함께 저장돼요.' },
  { key: 'never', label: '일정 연동 안 함', desc: '할일에 날짜를 설정해도 캘린더에는 따로 나타나지 않아요.' },
];

export default function TodoEventLinkSettingsModal({ onClose }: { onClose: () => void }) {
  useModalBackClose(onClose);
  const [pref, setPref] = useState<TodoEventLinkPref>(getTodoEventLinkPref());

  const choose = (p: TodoEventLinkPref) => {
    setPref(p);
    setTodoEventLinkPref(p);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">할일-일정 연동 설정</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">할일에 날짜를 설정했을 때, 그 날짜를 캘린더 일정으로도 함께 남길지 여기서 정할 수 있어요. 할일 입력창에서 &ldquo;다시 묻지 않기&rdquo;를 선택했을 때도 이 설정이 함께 바뀌어요.</p>
        <div className="space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => choose(o.key)}
              className={`w-full text-left p-3 rounded-2xl border transition ${pref === o.key ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{o.label}</span>
                {pref === o.key && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
