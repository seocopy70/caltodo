'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../lib/api-client';
import { MapPin, AlignLeft, Trash2, X, Repeat } from 'lucide-react';
import { getRecurrenceType } from '../../lib/recurrence';
import { useModalBackClose } from '../../lib/useModalBackClose';
import { useRecentInputs } from '../../lib/useRecentInputs';

type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

/** 구글 검색창처럼 최근 입력값을 입력창 아래에 후보로 보여주는 작은 재사용 UI. */
function AutocompleteDropdown({ suggestions, onSelect }: { suggestions: string[]; onSelect: (v: string) => void }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(s)}
          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 truncate"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function EventModal({ date, editingEvent, user, notify, onClose, onRefresh }: any) {
  useModalBackClose(onClose);
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
  const endTouchedRef = useRef(false); // 사용자가 종료시간을 직접 만졌는지 (만지면 자동 동기화 중단)
  const [titleSuggestOpen, setTitleSuggestOpen] = useState(false);
  const [locationSuggestOpen, setLocationSuggestOpen] = useState(false);
  const { remember: rememberTitle, suggestionsFor: titleSuggestionsFor } = useRecentInputs('event-title');
  const { remember: rememberLocation, suggestionsFor: locationSuggestionsFor } = useRecentInputs('event-location');

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
      setAllDay(format(sDate, 'HH:mm') === '00:00' && format(editingEvent.end as Date, 'HH:mm') === '23:59');
      setLocation(editingEvent.location || '');
      setDescription(editingEvent.description || '');
      setColor(editingEvent.color || 'blue');
      setRecurrenceType(getRecurrenceType(editingEvent));
      setRecurrenceCount(editingEvent.recurrenceCount ? String(editingEvent.recurrenceCount) : '');
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

  const save = () => {
    if (!title.trim() || !user) return;

    const effectiveStartTime = allDay || multiDay ? '00:00' : startTime;
    const effectiveEndTime = allDay || multiDay ? '23:59' : endTime;
    const start = new Date(`${startDate}T${effectiveStartTime}`);
    const end = new Date(`${multiDay ? endDate : startDate}T${effectiveEndTime}`);

    // 반복 일정은 항상 통일된 보라색으로 표시합니다.
    const effectiveColor = recurrenceType !== 'none' ? 'violet' : color;

    const eventData: any = {
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      endDate: multiDay && recurrenceType === 'none' ? new Date(`${endDate}T23:59`).toISOString() : null,
      location,
      description,
      color: effectiveColor,
      recurrenceType,
      recurrenceCount: recurrenceType !== 'none' && recurrenceCount.trim() ? Number(recurrenceCount) : null,
      // 기념일 관련 필드는 이 모달에서 다루지 않음(전용 화면에서 관리) — 기존 값을 그대로 유지
      isAnniversary: editingEvent?.isAnniversary || false,
      isLunar: editingEvent?.isLunar || false,
      lunarMonth: editingEvent?.lunarMonth ?? null,
      lunarDay: editingEvent?.lunarDay ?? null,
    };

    const targetId = editingEvent?.id;
    const isEdit = !!editingEvent;
    rememberTitle(title.trim());
    if (location.trim()) rememberLocation(location.trim());
    onClose();

    const task = isEdit ? api.events.update(targetId, eventData) : api.events.create(eventData);

    task
      .then(() => { notifyFn(isEdit ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.'); onRefresh?.(); })
      .catch((e: any) => {
        console.error(e);
        notifyFn(`저장 실패: ${e.isTimeout ? e.message : (e.message || e)}`, 'error');
        // 타임아웃 등으로 실패 토스트가 떠도 요청 자체는 서버에서 이미 처리됐을 수 있음(withTimeout 참고).
        // 새로고침을 안 하면 로컬 화면은 계속 "수정 전" 데이터를 들고 있어서, 다시 열었을 때
        // 방금 한 수정이 반영 안 된 것처럼("원래 수정창") 보이는 문제가 있었음 — 실패해도 항상 최신 상태로 동기화.
        onRefresh?.();
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
        onRefresh?.();
      });
  };

  const showTime = !allDay && !multiDay;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl">{editingEvent ? '일정 수정' : '새 일정'}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
          </div>
          <div className="relative">
            <input autoFocus className="w-full bg-transparent text-2xl font-bold focus:outline-none" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setTitleSuggestOpen(true)} onBlur={() => setTimeout(() => setTitleSuggestOpen(false), 150)} />
            {titleSuggestOpen && <AutocompleteDropdown suggestions={titleSuggestionsFor(title)} onSelect={(v) => { setTitle(v); setTitleSuggestOpen(false); }} />}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">시작 날짜</label>
              <input type="date" className="bg-transparent w-full outline-none text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            {showTime && <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">시작 시간</label>
              <input type="time" className="bg-transparent w-full outline-none" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
            </div>}
          </div>

          {/* 하루종일 / 며칠간 이어지는 일정을 한 줄로 */}
          <div className="flex gap-2">
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-2xl ${multiDay ? 'bg-slate-50 dark:bg-slate-800/40 opacity-50' : 'bg-slate-100 dark:bg-slate-800 cursor-pointer'}`}>
              <span className="flex-1 text-sm">하루 종일</span>
              <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={allDay} disabled={multiDay} onChange={(e) => setAllDay(e.target.checked)} />
            </label>
            {recurrenceType === 'none' && (
              <label className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl cursor-pointer">
                <span className="flex-1 text-sm">여러 날</span>
                {/* 여러 날 일정은 시간 없이 날짜만 다루므로, 체크하면 시간 선택은 숨김 */}
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={multiDay} onChange={(e) => { setMultiDay(e.target.checked); if (e.target.checked) setAllDay(false); if (!e.target.checked) setEndDate(startDate); }} />
              </label>
            )}
          </div>

          {multiDay && (
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">종료 날짜</label>
              <input type="date" className="bg-transparent w-full outline-none text-sm" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}

          <div className="relative flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <MapPin className="w-4 h-4 text-slate-500" />
            <input className="bg-transparent flex-1 outline-none text-sm" placeholder="장소" value={location} onChange={(e) => setLocation(e.target.value)} onFocus={() => setLocationSuggestOpen(true)} onBlur={() => setTimeout(() => setLocationSuggestOpen(false), 150)} />
            {locationSuggestOpen && <AutocompleteDropdown suggestions={locationSuggestionsFor(location)} onSelect={(v) => { setLocation(v); setLocationSuggestOpen(false); }} />}
          </div>
          <div className="flex items-start gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <AlignLeft className="w-4 h-4 text-slate-500 mt-1" />
            <textarea className="bg-transparent flex-1 outline-none text-sm h-20 resize-none" placeholder="메모" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* 끝나는 시간과 반복 일정을 각각 별도 영역으로 분리(전엔 한 줄에 몰려있어 좁은 화면에서 들쑥날쑥했음) */}
          {showTime && (
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
              <label className="text-[9px] text-slate-500 font-bold block mb-1">끝나는 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
              />
            </div>
          )}
          <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
            <label className="text-[9px] text-slate-500 font-bold block mb-1">반복 일정</label>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                className="flex-1 min-w-0 bg-white dark:bg-slate-900 text-sm rounded-lg px-2 py-1.5 outline-none border border-slate-300 dark:border-slate-700"
                value={recurrenceType}
                onChange={(e) => { const v = e.target.value as RecurrenceType; setRecurrenceType(v); if (v !== 'none') setMultiDay(false); }}
                disabled={multiDay}
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
                    className="w-14 shrink-0 bg-white dark:bg-slate-900 text-sm text-right rounded-lg px-1.5 py-1.5 outline-none border border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-xs text-slate-500 shrink-0">회</span>
                </>
              )}
            </div>
          </div>
          {multiDay && <p className="text-[11px] text-slate-500 -mt-2">며칠간 이어지는 일정은 반복을 설정할 수 없어요.</p>}
          {recurrenceType !== 'none' && !recurrenceCount.trim() && <p className="text-[11px] text-slate-500 -mt-2">횟수를 비워두면 계속 반복돼요.</p>}
          <p className="text-[11px] text-slate-500">생일 등 기념일은 메뉴 → 기념일 관리에서 따로 추가할 수 있어요.</p>

          <div className="flex justify-center gap-3">
            {['blue', 'green', 'amber', 'rose', 'violet'].map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-4 ring-slate-900 dark:ring-white scale-110' : 'opacity-40'} ${c === 'green' ? 'bg-emerald-500' : c === 'rose' ? 'bg-rose-500' : c === 'amber' ? 'bg-amber-500' : c === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`} />
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            {editingEvent && <button onClick={remove} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2 /></button>}
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 dark:text-slate-400">취소</button>
            <button onClick={save} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
