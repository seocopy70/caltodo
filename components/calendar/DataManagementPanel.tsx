'use client';

import { useState } from 'react';
import { api } from '../../lib/api-client';
import { X, Search, Trash2, AlertTriangle } from 'lucide-react';
import { useModalBackClose } from '../../lib/useModalBackClose';

export default function DataManagementPanel({ events, onNotify, onRefresh, onClose }: any) {
  useModalBackClose(onClose);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = onNotify || (() => {});

  const searchEvents = async () => {
    const q = query.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const result = await api.events.manage({ action: 'search', query: q });
      setSearchResults(result.events || []);
    } catch (err: any) { notify(err?.message || '검색에 실패했어요.', 'error'); }
    finally { setSearching(false); }
  };

  const deleteSearchResults = async () => {
    if (!query.trim() || searchResults.length === 0) return;
    if (!window.confirm(`'${query.trim()}' 검색 결과 ${searchResults.length}개를 모두 삭제할까요?`)) return;
    setBusy(true);
    try {
      const result = await api.events.manage({ action: 'delete_search', query: query.trim() });
      notify(`${result.deleted || 0}개의 일정을 삭제했어요.`);
      setSearchResults([]); onRefresh?.();
    } catch (err: any) { notify(err?.message || '삭제에 실패했어요.', 'error'); }
    finally { setBusy(false); }
  };

  const deleteImported = async () => {
    if (!window.confirm('가져오기(.ics)로 등록된 일정만 모두 삭제할까요?\n\n직접 만든 일정은 삭제되지 않습니다.')) return;
    setBusy(true);
    try {
      const result = await api.events.manage({ action: 'delete_imported' });
      notify(`${result.deleted || 0}개의 가져온 일정을 삭제했어요.`);
      setSearchResults([]); onRefresh?.();
    } catch (err: any) { notify(err?.message || '삭제에 실패했어요.', 'error'); }
    finally { setBusy(false); }
  };

  const deleteAll = async () => {
    if (!window.confirm(`현재 일정 ${events.length}개를 모두 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다. 먼저 JSON 백업을 권장합니다.`)) return;
    if (!window.confirm('정말 모든 일정을 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      const result = await api.events.manage({ action: 'delete_all' });
      notify(`${result.deleted || 0}개의 일정을 모두 삭제했어요.`);
      setSearchResults([]); onRefresh?.();
    } catch (err: any) { notify(err?.message || '전체 삭제에 실패했어요.', 'error'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
      <div className="p-6 space-y-5">
        <div className="flex justify-between items-center"><h3 className="font-bold text-xl text-white">일정데이터 관리</h3><button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X /></button></div>
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Search className="w-4 h-4 text-slate-400" /><h4 className="font-bold">일정 검색 / 삭제</h4></div>
          <div className="flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchEvents()} placeholder="제목, 장소, 내용 검색" className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none" /><button onClick={searchEvents} disabled={searching} className="px-4 py-2 bg-blue-600 rounded-xl font-bold text-sm">{searching ? '...' : '검색'}</button></div>
          {searchResults.length > 0 && <><div className="max-h-36 overflow-y-auto bg-slate-800/60 rounded-xl p-2">{searchResults.map((ev: any) => <div key={ev.id} className="text-xs px-2 py-1.5 flex justify-between"><span className="truncate">{ev.title}</span><span className="text-slate-500">{new Date(Number(ev.start)).toLocaleDateString('ko-KR')}</span></div>)}</div><button onClick={deleteSearchResults} disabled={busy} className="w-full py-2.5 bg-rose-600/20 border border-rose-500/30 text-rose-300 rounded-xl text-sm font-bold"><Trash2 className="w-4 h-4 inline mr-1" />검색 결과 {searchResults.length}개 삭제</button></>}
        </div>
        <div className="h-px bg-slate-800" />
        <div className="space-y-2"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><h4 className="font-bold">위험 작업</h4></div><button onClick={deleteImported} disabled={busy} className="w-full p-3 rounded-xl bg-slate-800 text-left text-sm font-bold"><Trash2 className="w-4 h-4 inline mr-2 text-amber-400" />가져온 일정만 삭제</button><button onClick={deleteAll} disabled={busy} className="w-full p-3 rounded-xl bg-rose-950/60 border border-rose-900 text-left text-sm font-bold text-rose-300"><Trash2 className="w-4 h-4 inline mr-2" />전체 일정 삭제 ({events.length}개)</button></div>
      </div>
    </div>
  </div>;
}
