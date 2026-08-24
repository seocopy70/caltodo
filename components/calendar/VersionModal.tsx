'use client';

import { X, Sparkles } from 'lucide-react';
import { APP_VERSION, APP_VERSION_NOTES } from '../../lib/version';

export default function VersionModal({ onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xl text-white">Cal2do</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X /></button>
          </div>
          <div className="text-3xl font-black text-blue-400">v{APP_VERSION}</div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> 이번 버전 주요 변경사항</p>
            <ul className="space-y-1.5">
              {APP_VERSION_NOTES.map((note, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-blue-400 shrink-0">•</span>{note}</li>)}
            </ul>
          </div>
          <button onClick={onClose} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-sm">닫기</button>
        </div>
      </div>
    </div>
  );
}
