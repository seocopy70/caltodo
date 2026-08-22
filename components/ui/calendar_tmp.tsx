'use client';

import { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, addDays, startOfDay, parseISO 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, MapPin, Clock, AlignLeft, Trash2, X } from 'lucide-react';

interface CalendarProps {
  view: 'month' | 'week';
  events: any[];
  db: any;
}

export default function Calendar({ view, events }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  
  // 입력 폼 상태
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');

  const monthStart = startOfMonth(currentDate);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart)),
  });

  // 일정 저장/수정 함수 (Firebase 연동)
  const saveEvent = async () => {
    if (!title) return;

    const startDateTime = new Date(selectedDate);
    const [startH, startM] = startTime.split(':');
    startDateTime.setHours(parseInt(startH), parseInt(startM));

    const endDateTime = new Date(selectedDate);
    const [endH, endM] = endTime.split(':');
    endDateTime.setHours(parseInt(endH), parseInt(endM));

    const eventData = {
      title,
      start: Timestamp.fromDate(startDateTime),
      end: Timestamp.fromDate(endDateTime),
      location,
      description,
      color,
      updatedAt: Timestamp.now()
    };

    try {
      if (editingEvent) {
        await updateDoc(doc(db, "events", editingEvent.id), eventData);
      } else {
        await addDoc(collection(db, "events"), eventData);
      }
      closeModal();
    } catch (e) {
      console.error("Error saving event: ", e);
    }
  };

  // 일정 삭제 함수
  const deleteEvent = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, "events", id));
      closeModal();
    }
  };

  const openAddModal = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setTitle('');
    setStartTime('09:00');
    setEndTime('10:00');
    setLocation('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (event: any) => {
    setEditingEvent(event);
    setSelectedDate(event.start);
    setTitle(event.title);
    setStartTime(format(event.start, 'HH:mm'));
    setEndTime(format(event.end, 'HH:mm'));
    setLocation(event.location || '');
    setDescription(event.description || '');
    setColor(event.color || 'blue');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* 캘린더 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {format(currentDate, 'yyyy년 MMMM', { locale: ko })}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-slate-800 rounded"><ChevronLeft /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm bg-slate-800 rounded hover:bg-slate-700">오늘</button>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-slate-800 rounded"><ChevronRight /></button>
        </div>
      </div>

      {/* 요일 표시 */}
      <div className="grid grid-cols-7 mb-2 text-center text-sm font-medium text-slate-400">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-slate-700">
        {days.map((day, i) => {
          const dayEvents = events.filter(e => isSameDay(e.start, day));
          return (
            <div 
              key={i}
              onClick={() => openAddModal(day)}
              className={`min-h-[100px] border-r border-b border-slate-700 p-1 cursor-pointer hover:bg-slate-800 transition-colors
                ${!isSameMonth(day, monthStart) ? 'opacity-30' : ''}
                ${isSameDay(day, new Date()) ? 'bg-blue-900/20' : ''}`}
            >
              <span className={`text-xs p-1 ${isSameDay(day, new Date()) ? 'bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white' : ''}`}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div 
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
                    className={`text-[10px] p-1 rounded truncate bg-${event.color || 'blue'}-600/30 border-l-2 border-${event.color || 'blue'}-500 text-${event.color || 'blue'}-200`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-[9px] text-slate-500 pl-1">+{dayEvents.length - 3}개 더보기</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 일정 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-bold text-lg">{editingEvent ? '일정 수정' : '새 일정 추가'}</h3>
              <button onClick={closeModal} className="p-1 hover:bg-slate-700 rounded"><X /></button>
            </div>
            
            <div className="p-5 space-y-4">
              <input 
                autoFocus
                className="w-full bg-transparent text-xl font-bold focus:outline-none placeholder:text-slate-600"
                placeholder="일정 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              
              <div className="flex items-center gap-3 text-slate-300">
                <Clock className="w-5 h-5 text-blue-400" />
                <div className="flex gap-2 flex-1">
                  <input type="time" className="bg-slate-800 p-1.5 rounded flex-1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  <span>~</span>
                  <input type="time" className="bg-slate-800 p-1.5 rounded flex-1" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-300">
                <MapPin className="w-5 h-5 text-red-400" />
                <input className="bg-slate-800 p-2 rounded flex-1 text-sm" placeholder="위치 추가" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <div className="flex items-center gap-3 text-slate-300">
                <AlignLeft className="w-5 h-5 text-green-400" />
                <textarea className="bg-slate-800 p-2 rounded flex-1 text-sm h-20 resize-none" placeholder="설명 추가" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-2">
                {['blue', 'green', 'amber', 'rose', 'violet'].map(c => (
                  <button 
                    key={c} 
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full bg-${c}-500 ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-800/30 flex justify-between gap-3">
              {editingEvent && (
                <button onClick={() => deleteEvent(editingEvent.id)} className="flex items-center gap-1 text-red-400 hover:bg-red-400/10 px-3 py-2 rounded text-sm transition">
                  <Trash2 className="w-4 h-4" /> 삭제
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={closeModal} className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded text-sm">취소</button>
                <button onClick={saveEvent} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-sm">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
