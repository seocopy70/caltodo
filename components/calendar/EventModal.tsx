'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../lib/api-client';
import { MapPin, AlignLeft, Trash2, X, Repeat, Cake, Moon } from 'lucide-react';
import { getRecurrenceType } from '../../lib/recurrence';
import { solarToLunar } from '../../lib/holidays';

type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

export default function EventModal({ date, editingEvent, user, notify, onClose, onRefresh }: any) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [multiDay, setMultiDay] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceCount, setRecurrenceCount] = useState(''); // 빈 값 = 계속 반복
  const [isAnniversary, setIsAnniversary] = useState(false); // 생일 등 기념일 (매년 반복 + 하루종일 편의 토글)
  const [isLunar, setIsLunar] = useState(false);
  const endTouchedRef = useRef(false); // 사용자가 종료시간을 직접 만졌는지 (만지면 자동 동기화 중단)

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
      const allDayFlag = format(sDate, 'HH:mm') === '00:00' && format(editingEvent.end as Date, 'HH:mm') === '23:59';
      setAllDay(allDayFlag);
      setLocation(editingEvent.location || '');
      setDescription(editingEvent.description || '');
      setColor(editingEvent.color || 'blue');
      const rt = getRecurrenceType(editingEvent);
      setRecurrenceType(rt);
      setRecurrenceCount(editingEvent.recurrenceCount ? String(editingEvent.recurrenceCount) : '');
      setIsLunar(!!editingEvent.isLunar);
      setIsAnniversary(rt === 'yearly' && (allDayFlag || !!editingEvent.isLunar));
      endTouchedRef.current = true; // 기존 일정은 저장된 종료시간을 그대로 존중 (자동 동기화 안 함)
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
      setAllDay(false);
      setLocation('');
      setDescription('');
      setColor('blue');
      setRecurrenceType('none');
      setRecurrenceCount('');
      setIsAnniversary(false);
      setIsLunar(false);
      endTouchedRef.current = false; // 새 일정은 시작시간 바꾸면 종료시간이 자동으로 1시간 뒤를 따라감
    }
  }, [editingEvent, date]);

  const notifyFn = notify || (() => {});

  // 종료시간을 직접 건드리기 전까지는, 시작시간이 바뀌면 항상 시작시간 + 1시간으로 맞춰줌
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (!endTouchedRef.current) {
      const [h, m] = value.split(':').map(Number);
      const total = (h * 60 + m + 60) % (24 * 60);
      setEndTime(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
    }
  };
  const handleEndTimeChange = (value: string) => {
    endTouchedRef.current = true;
    setEndTime(value);
  };

  const toggleAnniversary = (checked: boolean) => {
    setIsAnniversary(checked);
    if (checked) {
      setRecurrenceType('yearly');
      setAllDay(true);
      setMultiDay(false);
      setColor('rose');
    } else {
      setIsLunar(false);
    }
  };

  const save = () => {
    if (!title.trim() || !user) return;

    const effectiveStartTime = allDay ? '00:00' : startTime;
    const effectiveEndTime = allDay ? '23:59' : endTime;
    const start = new Date(`${startDate}T${effectiveStartTime}`);
    const end = new Date(`${multiDay ? endDate : startDate}T${effectiveEndTime}`);

    // 반복 일정은 항상 통일된 보라색으로 표시합니다 (기념일은 예외로 지정한 색 유지).
    const effectiveColor = recurrenceType !== 'none' && !isAnniversary ? 'violet' : color;

    // 음력 기념일이면 시작일(양력)을 음력 월/일로 변환해서 저장 -> 매년 그 음력 날짜의 양력 환산일에 반복
    let lunarMonth: number | null = null;
    let lunarDay: number | null = null;
    if (isAnniversary && isLunar) {
      const lunar = solarToLunar(start);
      lunarMonth = lunar.month;
      lunarDay = lunar.day;
    }

    const eventData: any = {
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      endDate: multiDay && recurrenceType === 'none' ? new Date(`${endDate}T${endTime}`).toISOString() : null,
      location,
      description,
      color: effectiveColor,
      recurrenceType,
      recurrenceCount: recurrenceType !== 'none' && recurrenceCount.trim() ? Number(recurrenceCount) : null,
      isLunar: isAnniversary && isLunar,
      lunarMonth,
      lunarDay,
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
            {!allDay && <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">시작 시간</label>
              <input type="time" className="bg-transparent w-full outline-none" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
            </div>}
          </div>

          {/* 하루종일 / 며칠간 이어지는 일정을 한 줄로 */}
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl cursor-pointer">
              <span className="flex-1 text-sm">하루 종일</span>
              <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={allDay} disabled={isAnniversary} onChange={(e) => setAllDay(e.target.checked)} />
            </label>
            {recurrenceType === 'none' && !isAnniversary && (
              <label className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl cursor-pointer">
                <span className="flex-1 text-sm">여러 날</span>
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={multiDay} onChange={(e) => { setMultiDay(e.target.checked); if (!e.target.checked) setEndDate(startDate); }} />
              </label>
            )}
          </div>

          {/* 기념일 / 음력을 한 줄로 */}
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl cursor-pointer">
              <Cake className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="flex-1 text-sm">기념일</span>
              <input type="checkbox" className="w-4 h-4 accent-rose-500" checked={isAnniversary} onChange={(e) => toggleAnniversary(e.target.checked)} />
            </label>
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-2xl ${isAnniversary ? 'bg-slate-100 dark:bg-slate-800 cursor-pointer' : 'bg-slate-50 dark:bg-slate-800/40 opacity-50'}`}>
              <Moon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="flex-1 text-sm">음력</span>
              <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={isLunar} disabled={!isAnniversary} onChange={(e) => setIsLunar(e.target.checked)} />
            </label>
          </div>

          <div className="flex gap-3">
            {multiDay && recurrenceType === 'none' && (
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
                <label className="text-[9px] text-slate-500 font-bold block mb-1">종료 날짜</label>
                <input type="date" className="bg-transparent w-full outline-none text-sm" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            {!allDay && <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">종료 시간</label>
              <input type="time" className="bg-transparent w-full outline-none" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} />
            </div>}
          </div>

          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <MapPin className="w-4 h-4 text-slate-500" />
            <input className="bg-transparent flex-1 outline-none text-sm" placeholder="장소" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="flex items-start gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <AlignLeft className="w-4 h-4 text-slate-500 mt-1" />
            <textarea className="bg-transparent flex-1 outline-none text-sm h-20 resize-none" placeholder="메모" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* 반복 종류 + 반복 횟수를 한 줄로 */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <Repeat className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              className="flex-1 min-w-0 bg-white dark:bg-slate-900 text-sm rounded-lg px-2 py-1.5 outline-none border border-slate-300 dark:border-slate-700"
              value={recurrenceType}
              onChange={(e) => { const v = e.target.value as RecurrenceType; setRecurrenceType(v); if (v !== 'none') setMultiDay(false); if (v === 'none') setIsAnniversary(false); }}
              disabled={multiDay || isAnniversary}
            >
              <option value="none">반복 안 함</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </select>
            {recurrenceType !== 'none' && (
              <>
                <input
                  type="number"
                  min={1}
                  placeholder="계속"
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                  className="w-16 shrink-0 bg-white dark:bg-slate-900 text-sm text-right rounded-lg px-2 py-1.5 outline-none border border-slate-300 dark:border-slate-700"
                />
                <span className="text-xs text-slate-500 shrink-0">회</span>
              </>
            )}
          </div>
          {multiDay && <p className="text-[11px] text-slate-500 -mt-3">며칠간 이어지는 일정은 반복을 설정할 수 없어요.</p>}
          {recurrenceType !== 'none' && !recurrenceCount.trim() && <p className="text-[11px] text-slate-500 -mt-3">횟수를 비워두면 계속 반복돼요.</p>}

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
