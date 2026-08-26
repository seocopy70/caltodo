'use client';

import { useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import { Upload, X, FileJson, CalendarDays, DatabaseBackup } from 'lucide-react';
import { eventsToICS, downloadTextFile, parseICS, type ParsedICSEvent } from '../../lib/ics';

export default function ImportExportPanel({ events, todos, notes, user, onNotify, onRefresh, onClose }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ParsedICSEvent[] | null>(null);
  const [pendingJsonImport, setPendingJsonImport] = useState<{ events: any[]; todos: any[]; notes: any[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const notify = onNotify || (() => {});

  const exportICS = () => { const ics = eventsToICS(events); downloadTextFile(`cal2do-events-${Date.now()}.ics`, ics); notify('일정을 .ics 파일로 내보냈어요.'); };
  const exportTodosTxt = () => {
    const lines = todos.map((t: any) => `${t.completed ? '[완료]' : '[  ]'} ${t.title}${t.dueDate ? ` (기한: ${new Date(t.dueDate).toLocaleDateString('ko-KR')})` : ''}${t.memo ? `\n    - ${t.memo}` : ''}`);
    downloadTextFile(`cal2do-todos-${Date.now()}.txt`, lines.join('\n'));
    notify('할 일을 텍스트 파일로 내보냈어요.');
  };
  const exportNotesTxt = () => {
    const lines = (notes || []).map((n: any) => `■ ${n.title}\n${n.content || ''}\n`);
    downloadTextFile(`cal2do-notes-${Date.now()}.txt`, lines.join('\n---\n\n'));
    notify('메모를 텍스트 파일로 내보냈어요.');
  };
  const exportJSON = () => {
    // id를 그대로 유지해서 내보냄 -> 다른 기기에서 가져오기 하면 원래 id로 복원되어 재가져오기해도 중복 생성되지 않음
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      events: events.map((e: any) => ({ ...e, start: e.start?.toISOString?.(), end: e.end?.toISOString?.(), endDate: e.endDate?.toISOString?.() ?? null, updatedAt: e.updatedAt?.toISOString?.() })),
      todos: todos.map((t: any) => ({ ...t, dueDate: t.dueDate?.toISOString?.() ?? null, completedAt: t.completedAt?.toISOString?.() ?? null, createdAt: t.createdAt?.toISOString?.() })),
      notes: (notes || []).map((n: any) => ({ ...n, updatedAt: n.updatedAt?.toISOString?.(), createdAt: n.createdAt?.toISOString?.(), deletedAt: n.deletedAt?.toISOString?.() ?? null })),
    };
    downloadTextFile(`cal2do-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    notify('전체 데이터를 JSON 백업 파일로 내보냈어요.');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    try { const parsed = parseICS(text); if (parsed.length === 0) { notify('파일에서 일정을 찾지 못했어요.', 'error'); return; } setPendingImport(parsed); }
    catch (err) { console.error(err); notify('파일을 읽는 중 문제가 발생했어요.', 'error'); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleJsonFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || (!Array.isArray(parsed.events) && !Array.isArray(parsed.todos) && !Array.isArray(parsed.notes))) {
        notify('Cal2do 백업 파일 형식이 아니에요.', 'error');
        return;
      }
      setPendingJsonImport({ events: parsed.events || [], todos: parsed.todos || [], notes: parsed.notes || [] });
    } catch (err) {
      console.error(err);
      notify('백업 파일을 읽는 중 문제가 발생했어요.', 'error');
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
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

  const confirmJsonImport = async () => {
    if (!pendingJsonImport || !user) return;
    setImporting(true);
    let count = 0;
    try {
      for (const ev of pendingJsonImport.events) { await api.events.create(ev); count++; }
      for (const t of pendingJsonImport.todos) { await api.todos.create({ ...t, skipLink: true }); count++; }
      for (const n of pendingJsonImport.notes) { await api.notes.create(n); count++; }
      notify(`백업에서 ${count}개 항목을 복원했어요.`);
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      notify(`복원 중 일부 실패: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
      setPendingJsonImport(null);
    }
  };

  return <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"><div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"><div className="p-6 space-y-5"><div className="flex justify-between items-center"><h3 className="font-bold text-xl text-slate-900 dark:text-white">가져오기 / 내보내기</h3><button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button></div>
    {pendingJsonImport ? (
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-200">백업 파일에서 일정 <span className="font-bold text-blue-500 dark:text-blue-400">{pendingJsonImport.events.length}개</span>, 할 일 <span className="font-bold text-emerald-500 dark:text-emerald-400">{pendingJsonImport.todos.length}개</span>, 메모 <span className="font-bold text-amber-500 dark:text-amber-400">{pendingJsonImport.notes.length}개</span>를 찾았어요.</p>
        <p className="text-xs text-slate-500">같은 항목을 다시 가져와도 원래 id로 덮어써져서 중복 생성되지 않아요.</p>
        <div className="flex gap-3"><button onClick={() => setPendingJsonImport(null)} className="flex-1 py-3 font-bold text-slate-500 dark:text-slate-400">취소</button><button disabled={importing} onClick={confirmJsonImport} className="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-bold">{importing ? '복원하는 중...' : '전체 복원하기'}</button></div>
      </div>
    ) : !pendingImport ? <>
      <div className="space-y-2">
        <p className="text-xs text-slate-500">구글 캘린더 · 삼성 캘린더에서 .ics 파일을 가져올 수 있어요. 같은 외부 일정은 다시 가져와도 중복 생성하지 않습니다.</p>
        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl"><Upload className="w-5 h-5 text-blue-500 dark:text-blue-400" /><div className="text-left"><p className="font-bold text-sm text-slate-900 dark:text-white">.ics 파일 가져오기</p><p className="text-[11px] text-slate-500">구글/삼성 캘린더에서 내보낸 파일 선택</p></div></button>
        <input ref={fileInputRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={handleFileSelect} />
        <button onClick={() => jsonInputRef.current?.click()} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl"><DatabaseBackup className="w-5 h-5 text-violet-500 dark:text-violet-400" /><div className="text-left"><p className="font-bold text-sm text-slate-900 dark:text-white">전체 백업 가져오기 (.json)</p><p className="text-[11px] text-slate-500">기기를 바꿨을 때 백업 파일로 그대로 복원</p></div></button>
        <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFileSelect} />
      </div>
      <div className="h-px bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2"><button onClick={exportICS} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl"><CalendarDays className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /><span className="font-bold text-sm text-slate-900 dark:text-white">일정 내보내기 (.ics)</span></button><button onClick={exportTodosTxt} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl"><FileJson className="w-5 h-5 text-blue-500 dark:text-blue-400" /><span className="font-bold text-sm text-slate-900 dark:text-white">할 일 내보내기 (.txt)</span></button><button onClick={exportNotesTxt} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl"><FileJson className="w-5 h-5 text-amber-500 dark:text-amber-400" /><span className="font-bold text-sm text-slate-900 dark:text-white">메모 내보내기 (.txt)</span></button><button onClick={exportJSON} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl"><FileJson className="w-5 h-5 text-violet-500 dark:text-violet-400" /><span className="font-bold text-sm text-slate-900 dark:text-white">전체 백업 (JSON, 일정+할일+메모)</span></button></div>
    </> : <div className="space-y-4"><p className="text-sm text-slate-700 dark:text-slate-200">총 <span className="font-bold text-blue-500 dark:text-blue-400">{pendingImport.length}개</span>의 일정을 찾았어요. 캘린더에 추가할까요?</p><div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3">{pendingImport.slice(0, 20).map((ev, i) => <p key={i} className="text-xs text-slate-500 dark:text-slate-400 truncate">• {ev.title} ({ev.start.toLocaleDateString('ko-KR')})</p>)}</div><div className="flex gap-3"><button onClick={() => setPendingImport(null)} className="flex-1 py-3 font-bold text-slate-500 dark:text-slate-400">취소</button><button disabled={importing} onClick={confirmImport} className="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-bold">{importing ? '가져오는 중...' : '가져오기'}</button></div></div>}
  </div></div></div>;
}
