'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../lib/api-client';
import { MapPin, AlignLeft, Trash2, X, Repeat, CalendarRange } from 'lucide-react';
import { getRecurrenceType } from '../../lib/recurrence';

type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

export default function EventModal({ date, editingEvent, user, notify, onClose, onRefresh }: any) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [multiDay, setMultiDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');

  useEffect(() => {
    if (editingEvent) {
      const sDate = editingEvent.start as Date;
      const eDate = (editingEvent.endDate as Date) || sDate;
      setTitle(editingEvent.title || '');
      setStartDate(format(sDate, 'yyyy-MM-dd'));
      setStartTime(format(sDate, 'HH:mm'));
      setEndDate(format(eDate, 'yyyy-MM-dd'));
      setEndTime(format(editingEvent.end as Date, 'HH:mm'));
      setMultiDay(!!editingEvent.endDate && format(eDate, 'yyyy-MM-dd') !== format(sDate, 'yyyy-MM-dd'));
      setLocation(editingEvent.location || '');
      setDescription(editingEvent.description || '');
      setColor(editingEvent.color || 'blue');
      setRecurrenceType(getRecurrenceType(editingEvent));
    } else {
      const base = date || new Date();
      const hasTime = base.getHours() !== 0 || base.getMinutes() !== 0;
      const defaultStart = hasTime ? format(base, 'HH:mm') : '09:00';
      const defaultEndBase = new Date(base.getTime() + 60 * 60 * 1000);
      setTitle('');
      setStartDate(format(base, 'yyyy-MM-dd'));
      setStartTime(defaultStart);
      setEndDate(format(base, 'yyyy-MM-dd'));
      setEndTime(hasTime ? format(defaultEndBase, 'HH:mm') : '10:00');
      setMultiDay(false);
      setLocation('');
      setDescription('');
      setColor('blue');
      setRecurrenceType('none');
    }
  }, [editingEvent, date]);

  const notifyFn = notify || (() => {});

  const save = () => {
    if (!title.trim() || !user) return;

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${multiDay ? endDate : startDate}T${endTime}`);

    // 반복 일정은 항상 통일된 보라색으로 표시합니다.
    const effectiveColor = recurrenceType !== 'none' ? 'violet' : color;

    const eventData: any = {
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      endDate: multiDay && recurrenceType === 'none' ? new Date(`${endDate}T${endTime}`).toISOString() : null,
      location,
      description,
      color: effectiveColor,
      recurrenceType,
    };

    const targetId = editingEvent?.id;
    const isEdit = !!editingEvent;
    onClose();

    const task = isEdit ? api.events.update(targetId, eventData) : api.events.create(eventData);

    task
      .then(() => { notifyFn(isEdit ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.'); onRefresh?.(); })
      .catch((e: any) => {
        console.error(e);
        notifyFn(`저장 실패: ${e.isTimeout ? e.message : (e.message || e)}`, 'error');
      });
  };

  const remove = () => {
    if (!editingEvent || !confirm('삭제할까요?')) return;
    const id = editingEvent.id;
    onClose();

    api.events.remove(id)
      .then(() => { notifyFn('일정이 삭제되었습니다.'); onRefresh?.(); })
      .catch((e: any) => {
        console.error(e);
        notifyFn(`삭제 실패: ${e.isTimeout ? e.message : (e.message || e)}`, 'error');
      });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl">{editingEvent ? '일정 수정' : '새 일정'}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
          </div>
          <input autoFocus className="w-full bg-transparent text-2xl font-bold focus:outline-none" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div className="flex gap-3">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">시작 날짜</label>
              <input type="date" className="bg-transparent w-full outline-none text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">시작 시간</label>
              <input type="time" className="bg-transparent w-full outline-none" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          {recurrenceType === 'none' && (
            <label className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl cursor-pointer">
              <CalendarRange className="w-4 h-4 text-slate-500" />
              <span className="flex-1 text-sm">며칠간 이어지는 일정</span>
              <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={multiDay} onChange={(e) => { setMultiDay(e.target.checked); if (!e.target.checked) setEndDate(startDate); }} />
            </label>
          )}

          <div className="flex gap-3">
            {multiDay && recurrenceType === 'none' && (
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
                <label className="text-[9px] text-slate-500 font-bold block mb-1">종료 날짜</label>
                <input type="date" className="bg-transparent w-full outline-none text-sm" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">종료 시간</label>
              <input type="time" className="bg-transparent w-full outline-none" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <MapPin className="w-4 h-4 text-slate-500" />
            <input className="bg-transparent flex-1 outline-none text-sm" placeholder="장소" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="flex items-start gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <AlignLeft className="w-4 h-4 text-slate-500 mt-1" />
            <textarea className="bg-transparent flex-1 outline-none text-sm h-20 resize-none" placeholder="메모" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <Repeat className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="flex-1 text-sm">반복</span>
            <select
              className="bg-white dark:bg-slate-900 text-sm rounded-lg px-2 py-1.5 outline-none border border-slate-300 dark:border-slate-700"
              value={recurrenceType}
              onChange={(e) => { const v = e.target.value as RecurrenceType; setRecurrenceType(v); if (v !== 'none') setMultiDay(false); }}
              disabled={multiDay}
            >
              <option value="none">안 함</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </select>
          </div>
          {multiDay && <p className="text-[11px] text-slate-500 -mt-3">며칠간 이어지는 일정은 반복을 설정할 수 없어요.</p>}

          <div className="flex justify-center gap-3">
            {['blue', 'green', 'amber', 'rose', 'violet'].map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-4 ring-slate-900 dark:ring-white scale-110' : 'opacity-40'} ${c === 'green' ? 'bg-emerald-500' : c === 'rose' ? 'bg-rose-500' : c === 'amber' ? 'bg-amber-500' : c === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`} />
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            {editingEvent && <button onClick={remove} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2 /></button>}
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 dark:text-slate-400">취소</button>
            <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
