'use client';

import { useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import { Download, Upload, X, FileJson, CalendarDays, Search, Trash2, AlertTriangle } from 'lucide-react';
import { eventsToICS, downloadTextFile, parseICS, type ParsedICSEvent } from '../../lib/ics';

export default function ImportExportPanel({ events, todos, notes, user, onNotify, onRefresh, onClose }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ParsedICSEvent[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = onNotify || (() => {});

  const exportICS = () => { const ics = eventsToICS(events); downloadTextFile(`caltodo-events-${Date.now()}.ics`, ics); notify('일정을 .ics 파일로 내보냈어요.'); };
  const exportJSON = () => { const backup = { exportedAt: new Date().toISOString(), events: events.map((e: any) => ({ ...e, start: e.start?.toISOString?.(), end: e.end?.toISOString?.(), endDate: e.endDate?.toISOString?.() })), todos: todos.map((t: any) => ({ ...t, dueDate: t.dueDate?.toISOString?.() ?? null })), notes: notes?.map((n: any) => ({ ...n, updatedAt: n.updatedAt?.toISOString?.() })) || [] }; downloadTextFile(`caltodo-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json'); notify('전체 데이터를 JSON 백업 파일로 내보냈어요.'); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    try { const parsed = parseICS(text); if (parsed.length === 0) { notify('파일에서 일정을 찾지 못했어요.', 'error'); return; } setPendingImport(parsed); }
    catch (err) { console.error(err); notify('파일을 읽는 중 문제가 발생했어요.', 'error'); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const confirmImport = async () => {
    if (!pendingImport || !user) return;
    setImporting(true); let success = 0; let skipped = 0;
    for (const ev of pendingImport) {
      try {
        const result = await api.events.create({ title: ev.title, start: ev.start.toISOString(), end: ev.end.toISOString(), endDate: null, location: ev.location || '', description: ev.description || '', color: ev.isRecurring ? 'violet' : 'blue', recurrenceType: ev.recurrenceType, source: 'google_ics', externalUid: ev.externalUid || `${ev.title}|${ev.start.getTime()}|${ev.end.getTime()}` });
        if (result.skipped) skipped++; else success++;
      } catch (err) { console.error('가져오기 실패:', ev.title, err); }
    }
    setImporting(false); setPendingImport(null); notify(`${success}개 가져옴${skipped ? ` · ${skipped}개는 이미 있어 건너뜀` : ''}.`); onRefresh?.();
  };

  const searchEvents = async () => { const q = query.trim(); if (!q) { setSearchResults([]); return; } setSearching(true); try { const result = await api.events.manage({ action: 'search', query: q }); setSearchResults(result.events || []); } catch (err: any) { notify(err?.message || '검색에 실패했어요.', 'error'); } finally { setSearching(false); } };
  const deleteSearchResults = async () => { if (!query.trim() || searchResults.length === 0) return; if (!window.confirm(`'${query.trim()}' 검색 결과 ${searchResults.length}개를 모두 삭제할까요?`)) return; setBusy(true); try { const result = await api.events.manage({ action: 'delete_search', query: query.trim() }); notify(`${result.deleted || 0}개의 일정을 삭제했어요.`); setSearchResults([]); onRefresh?.(); } catch (err: any) { notify(err?.message || '삭제에 실패했어요.', 'error'); } finally { setBusy(false); } };
  const deleteImported = async () => { if (!window.confirm('가져오기(.ics)로 등록된 일정만 모두 삭제할까요?\n\n직접 만든 일정은 삭제되지 않습니다.')) return; setBusy(true); try { const result = await api.events.manage({ action: 'delete_imported' }); notify(`${result.deleted || 0}개의 가져온 일정을 삭제했어요.`); setSearchResults([]); onRefresh?.(); } catch (err: any) { notify(err?.message || '삭제에 실패했어요.', 'error'); } finally { setBusy(false); } };
  const deleteAll = async () => { if (!window.confirm(`현재 일정 ${events.length}개를 모두 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다. 먼저 JSON 백업을 권장합니다.`)) return; if (!window.confirm('정말 모든 일정을 삭제하시겠습니까?')) return; setBusy(true); try { const result = await api.events.manage({ action: 'delete_all' }); notify(`${result.deleted || 0}개의 일정을 모두 삭제했어요.`); setSearchResults([]); onRefresh?.(); } catch (err: any) { notify(err?.message || '전체 삭제에 실패했어요.', 'error'); } finally { setBusy(false); } };

  return <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"><div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"><div className="p-6 space-y-5"><div className="flex justify-between items-center"><h3 className="font-bold text-xl text-white">가져오기 / 데이터 관리</h3><button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X/></button></div>{!pendingImport ? <><div className="space-y-2"><p className="text-xs text-slate-500">구글 캘린더 · 삼성 캘린더에서 .ics 파일을 가져올 수 있어요. 같은 외부 일정은 다시 가져와도 중복 생성하지 않습니다.</p><button onClick={()=>fileInputRef.current?.click()} className="w-full flex items-center gap-3 bg-slate-800 p-4 rounded-2xl"><Upload className="w-5 h-5 text-blue-400"/><div className="text-left"><p className="font-bold text-sm">.ics 파일 가져오기</p><p className="text-[11px] text-slate-500">구글/삼성 캘린더에서 내보낸 파일 선택</p></div></button><input ref={fileInputRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={handleFileSelect}/></div><div className="h-px bg-slate-800"/><div className="space-y-2"><button onClick={exportICS} className="w-full flex items-center gap-3 bg-slate-800 p-4 rounded-2xl"><CalendarDays className="w-5 h-5 text-emerald-400"/><span className="font-bold text-sm">일정 내보내기 (.ics)</span></button><button onClick={exportJSON} className="w-full flex items-center gap-3 bg-slate-800 p-4 rounded-2xl"><FileJson className="w-5 h-5 text-amber-400"/><span className="font-bold text-sm">전체 백업 (JSON)</span></button></div><div className="h-px bg-slate-800"/><div className="space-y-3"><div className="flex items-center gap-2"><Search className="w-4 h-4 text-slate-400"/><h4 className="font-bold">일정 검색 / 삭제</h4></div><div className="flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchEvents()} placeholder="제목, 장소, 내용 검색" className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"/><button onClick={searchEvents} disabled={searching} className="px-4 py-2 bg-blue-600 rounded-xl font-bold text-sm">{searching?'...':'검색'}</button></div>{searchResults.length>0&&<><div className="max-h-36 overflow-y-auto bg-slate-800/60 rounded-xl p-2">{searchResults.map((ev:any)=><div key={ev.id} className="text-xs px-2 py-1.5 flex justify-between"><span className="truncate">{ev.title}</span><span className="text-slate-500">{new Date(Number(ev.start)).toLocaleDateString('ko-KR')}</span></div>)}</div><button onClick={deleteSearchResults} disabled={busy} className="w-full py-2.5 bg-rose-600/20 border border-rose-500/30 text-rose-300 rounded-xl text-sm font-bold"><Trash2 className="w-4 h-4 inline mr-1"/>검색 결과 {searchResults.length}개 삭제</button></>}</div><div className="h-px bg-slate-800"/><div className="space-y-2"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400"/><h4 className="font-bold">위험 작업</h4></div><button onClick={deleteImported} disabled={busy} className="w-full p-3 rounded-xl bg-slate-800 text-left text-sm font-bold"><Trash2 className="w-4 h-4 inline mr-2 text-amber-400"/>가져온 일정만 삭제</button><button onClick={deleteAll} disabled={busy} className="w-full p-3 rounded-xl bg-rose-950/60 border border-rose-900 text-left text-sm font-bold text-rose-300"><Trash2 className="w-4 h-4 inline mr-2"/>전체 일정 삭제 ({events.length}개)</button></div></> : <div className="space-y-4"><p className="text-sm">총 <span className="font-bold text-blue-400">{pendingImport.length}개</span>의 일정을 찾았어요. 캘린더에 추가할까요?</p><div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-800/50 rounded-xl p-3">{pendingImport.slice(0,20).map((ev,i)=><p key={i} className="text-xs text-slate-400 truncate">• {ev.title} ({ev.start.toLocaleDateString('ko-KR')})</p>)}</div><div className="flex gap-3"><button onClick={()=>setPendingImport(null)} className="flex-1 py-3 font-bold text-slate-400">취소</button><button disabled={importing} onClick={confirmImport} className="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-bold">{importing?'가져오는 중...':'가져오기'}</button></div></div>}</div></div></div>;
}
