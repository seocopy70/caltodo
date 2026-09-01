'use client';

import { useRef, useState } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, Plus } from 'lucide-react';
import { useModalBackClose } from '../../lib/useModalBackClose';
import TimeGrid from './TimeGrid';
import EventModal from './EventModal';
import { eventOccursOnDay } from '../../lib/recurrence';

export default function DayViewModal({ date, events, holidayMap, user, onNotify, onRefresh, onClose }: any) {
  useModalBackClose(onClose);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [prefillDate, setPrefillDate] = useState<Date>(date);
  // 원래 열려있던 날짜에서 좌우로 스와이프하면 하루씩 이동(부모 상태는 안 건드리고 이 창 안에서만 바뀜)
  const [currentDate, setCurrentDate] = useState<Date>(date);

  const dayEvents = (events || []).filter((e: any) => eventOccursOnDay(e, currentDate));

  const openNew = (base?: Date) => { setEditingEvent(null); setPrefillDate(base || currentDate); setIsModalOpen(true); };
  const openEdit = (event: any) => { setEditingEvent(event); setPrefillDate(event.start); setIsModalOpen(true); };
  const closeEventModal = () => { setIsModalOpen(false); setEditingEvent(null); };

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // 세로 스크롤(시간표를 위아래로 보는 동작)과 헷갈리지 않도록, 가로로 뚜렷하게 밀었을 때만 날짜 이동
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    setCurrentDate((d) => (deltaX < 0 ? addDays(d, 1) : subDays(d, 1)));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="font-black text-lg">{format(currentDate, 'M월 d일 (EEE)', { locale: ko })}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
        </div>
        <div className="p-3 overflow-y-auto flex-1" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <TimeGrid
            days={[currentDate]}
            events={dayEvents}
            holidayMap={holidayMap}
            onSlotClick={(day: Date, hour: number) => openNew(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0))}
            onEventClick={openEdit}
          />
        </div>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button onClick={() => openNew(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 9, 0))} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">
            <Plus className="w-5 h-5" /> 새 일정
          </button>
        </div>
      </div>
      {isModalOpen && <EventModal date={prefillDate} editingEvent={editingEvent} user={user} notify={onNotify} onClose={closeEventModal} onRefresh={onRefresh} />}
    </div>
  );
}
