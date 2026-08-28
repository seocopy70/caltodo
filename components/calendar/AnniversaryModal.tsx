'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, Cake, Moon, Trash2, Plus, List, Pencil } from 'lucide-react';
import { api } from '../../lib/api-client';
import { solarToLunar } from '../../lib/holidays';
import { useModalBackClose } from '../../lib/useModalBackClose';
import LunarDatePicker from './LunarDatePicker';

export default function AnniversaryModal({ events, user, notify, onClose, onRefresh }: any) {
  useModalBackClose(onClose);
  const [tab, setTab] = useState<'add' | 'list'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLunar, setIsLunar] = useState(false);
  const notifyFn = notify || (() => {});

  const anniversaries = useMemo(
    () => (events || []).filter((e: any) => e.isAnniversary).sort((a: any, b: any) => a.start.getMonth() - b.start.getMonth() || a.start.getDate() - b.start.getDate()),
    [events]
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDateStr(format(new Date(), 'yyyy-MM-dd'));
    setIsLunar(false);
  };

  const startEdit = (ev: any) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setDateStr(format(ev.start, 'yyyy-MM-dd'));
    setIsLunar(!!ev.isLunar);
    setTab('add');
  };

  const save = () => {
    if (!title.trim() || !user) return;
    const start = new Date(`${dateStr}T00:00:00`);
    let lunarMonth: number | null = null;
    let lunarDay: number | null = null;
    if (isLunar) {
      const lunar = solarToLunar(start);
      lunarMonth = lunar.month;
      lunarDay = lunar.day;
    }
    const eventData = {
      title: title.trim(),
      start: start.toISOString(),
      end: new Date(`${dateStr}T23:59:00`).toISOString(),
      endDate: null,
      location: '',
      description: '',
      color: 'rose',
      recurrenceType: 'yearly',
      recurrenceCount: null,
      isAnniversary: true,
      isLunar,
      lunarMonth,
      lunarDay,
    };
    const isEdit = !!editingId;
    const task = isEdit ? api.events.update(editingId, eventData) : api.events.create(eventData);
    task
      .then(() => { notifyFn(isEdit ? '기념일이 수정되었습니다.' : '기념일이 추가되었습니다.'); onRefresh?.(); resetForm(); setTab('list'); })
      .catch((e: any) => notifyFn(`저장 실패: ${e.message || e}`, 'error'));
  };

  const remove = (id: string) => {
    if (!confirm('이 기념일을 삭제할까요?')) return;
    api.events.remove(id).then(() => { notifyFn('기념일이 삭제되었습니다.'); onRefresh?.(); }).catch((e: any) => notifyFn(`삭제 실패: ${e.message || e}`, 'error'));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 pb-0 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-xl flex items-center gap-2"><Cake className="w-5 h-5 text-rose-500" /> 기념일 관리</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
        </div>

        <div className="flex gap-2 px-6 pt-4 shrink-0">
          <button onClick={() => setTab('add')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold ${tab === 'add' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Plus className="w-4 h-4" /> {editingId ? '수정' : '추가'}</button>
          <button onClick={() => { resetForm(); setTab('list'); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><List className="w-4 h-4" /> 모아보기 ({anniversaries.length})</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'add' ? (
            <div className="space-y-4">
              <input autoFocus className="w-full bg-transparent text-xl font-bold focus:outline-none border-b border-slate-200 dark:border-slate-700 pb-2" placeholder="예: OO 생일" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
                <label className="text-[9px] text-slate-500 font-bold block mb-1">최초 연월일</label>
                <input type="date" className="bg-transparent w-full outline-none text-sm" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
              </div>
              <label className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl cursor-pointer">
                <Moon className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="flex-1 text-sm">음력 기준으로 매년 반복</span>
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={isLunar} onChange={(e) => setIsLunar(e.target.checked)} />
              </label>
              {isLunar && (
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">달력에서 원하는 음력 날짜가 표시된 칸을 눌러 고르세요.</p>
                  <LunarDatePicker value={dateStr} onChange={setDateStr} />
                  <p className="text-[11px] text-blue-500 dark:text-blue-400 font-bold">선택한 날짜의 음력: {(() => { const d = new Date(`${dateStr}T00:00:00`); const l = solarToLunar(d); return `${l.month}월 ${l.day}일`; })()}</p>
                </div>
              )}
              <p className="text-[11px] text-slate-500">입력한 날짜를 기준으로 매년 반복돼요. {isLunar ? '음력 기준이라, 매년 양력 날짜는 조금씩 달라져요.' : ''}</p>
              <div className="flex gap-3 pt-2">
                {editingId && <button onClick={() => remove(editingId)} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2 /></button>}
                <button onClick={() => { resetForm(); }} className="flex-1 py-3 font-bold text-slate-500 dark:text-slate-400">{editingId ? '취소' : '초기화'}</button>
                <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {anniversaries.length === 0 && <p className="text-center text-sm text-slate-500 py-8">등록된 기념일이 없어요.</p>}
              {anniversaries.map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <Cake className="w-4 h-4 text-rose-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{ev.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {ev.isLunar && ev.lunarMonth != null && ev.lunarDay != null
                        ? `음력 ${ev.lunarMonth}월 ${ev.lunarDay}일`
                        : format(ev.start, 'M월 d일', { locale: ko })}
                    </p>
                  </div>
                  <button onClick={() => startEdit(ev)} className="p-2 text-slate-400 hover:text-blue-500 shrink-0"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(ev.id)} className="p-2 text-slate-400 hover:text-rose-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
