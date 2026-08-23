'use client';

import { useRef, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Download, Upload, X, FileJson, CalendarDays } from 'lucide-react';
import { eventsToICS, downloadTextFile, parseICS, type ParsedICSEvent } from '../../lib/ics';

export default function ImportExportPanel({ events, todos, notes, user, onNotify, onClose }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ParsedICSEvent[] | null>(null);
  const [importing, setImporting] = useState(false);

  const notify = onNotify || (() => {});

  const exportICS = () => {
    const ics = eventsToICS(events);
    downloadTextFile(`caltodo-events-${Date.now()}.ics`, ics);
    notify('일정을 .ics 파일로 내보냈어요.');
  };

  const exportJSON = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      events: events.map((e: any) => ({ ...e, start: e.start?.toISOString?.(), end: e.end?.toISOString?.(), endDate: e.endDate?.toISOString?.() })),
      todos: todos.map((t: any) => ({ ...t, dueDate: t.dueDate?.toISOString?.() ?? null })),
      notes: notes?.map((n: any) => ({ ...n, updatedAt: n.updatedAt?.toISOString?.() })) || [],
    };
    downloadTextFile(`caltodo-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    notify('전체 데이터를 JSON 백업 파일로 내보냈어요.');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseICS(text);
      if (parsed.length === 0) {
        notify('파일에서 일정을 찾지 못했어요. 올바른 .ics 파일인지 확인해주세요.', 'error');
        return;
      }
      setPendingImport(parsed);
    } catch (err) {
      console.error(err);
      notify('파일을 읽는 중 문제가 발생했어요.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!pendingImport || !user) return;
    setImporting(true);
    let success = 0;
    for (const ev of pendingImport) {
      try {
        await addDoc(collection(db, 'events'), {
          title: ev.title,
          userId: user.uid,
          start: Timestamp.fromDate(ev.start),
          end: Timestamp.fromDate(ev.end),
          endDate: null,
          location: ev.location || '',
          description: ev.description || '',
          color: 'blue',
          recurrenceType: ev.recurrenceType,
          recurring: ev.recurrenceType === 'yearly',
          updatedAt: Timestamp.now(),
        });
        success++;
      } catch (err) {
        console.error('가져오기 실패:', ev.title, err);
      }
    }
    setImporting(false);
    setPendingImport(null);
    notify(`${success}개의 일정을 가져왔어요.${success < pendingImport.length ? ` (${pendingImport.length - success}개 실패)` : ''}`);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl text-white">가져오기 / 내보내기</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full"><X /></button>
          </div>

          {!pendingImport ? (
            <>
              <div className="space-y-2">
                <p className="text-xs text-slate-500 px-1">구글 캘린더 · 삼성 캘린더에서 &quot;내보내기&quot;로 받은 .ics 파일을 가져올 수 있어요.</p>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 transition p-4 rounded-2xl">
                  <Upload className="w-5 h-5 text-blue-400" />
                  <div className="text-left">
                    <p className="font-bold text-sm">.ics 파일 가져오기</p>
                    <p className="text-[11px] text-slate-500">구글/삼성 캘린더에서 내보낸 파일 선택</p>
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={handleFileSelect} />
              </div>

              <div className="h-px bg-slate-800" />

              <div className="space-y-2">
                <button onClick={exportICS} className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 transition p-4 rounded-2xl">
                  <CalendarDays className="w-5 h-5 text-emerald-400" />
                  <div className="text-left">
                    <p className="font-bold text-sm">일정 내보내기 (.ics)</p>
                    <p className="text-[11px] text-slate-500">다른 캘린더 앱에서 가져오기 가능</p>
                  </div>
                </button>
                <button onClick={exportJSON} className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 transition p-4 rounded-2xl">
                  <FileJson className="w-5 h-5 text-amber-400" />
                  <div className="text-left">
                    <p className="font-bold text-sm">전체 백업 (JSON)</p>
                    <p className="text-[11px] text-slate-500">일정 · 할 일 · 메모 전부 포함</p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                총 <span className="font-bold text-blue-400">{pendingImport.length}개</span>의 일정을 찾았어요. 캘린더에 추가할까요?
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-800/50 rounded-xl p-3">
                {pendingImport.slice(0, 20).map((ev, i) => (
                  <p key={i} className="text-xs text-slate-400 truncate">• {ev.title} ({ev.start.toLocaleDateString('ko-KR')})</p>
                ))}
                {pendingImport.length > 20 && <p className="text-xs text-slate-600">외 {pendingImport.length - 20}개...</p>}
              </div>
              <div className="flex gap-3">
                <button disabled={importing} onClick={() => setPendingImport(null)} className="flex-1 py-3 font-bold text-slate-400 disabled:opacity-40">취소</button>
                <button disabled={importing} onClick={confirmImport} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold disabled:opacity-60">
                  {importing ? '가져오는 중...' : '가져오기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
