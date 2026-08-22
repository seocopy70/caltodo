'use client';

import { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, addDays, subDays, isWithinInterval 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, MapPin, Clock, AlignLeft, Trash2, X } from 'lucide-react';

export default function Calendar({ view, events, user }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');

  const monthStart = startOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({
    start: view === 'month' ? startOfWeek(monthStart) : weekStart,
    end: view === 'month' ? endOfWeek(endOfMonth(monthStart)) : endOfWeek(currentDate),
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setTitle('');
    setStartTime('09:00');
    setEndTime('10:00');
    setLocation('');
    setDescription('');
    setColor('blue');
  };

  const saveEvent = async () => {
    if (!title.trim() || !user) return;

    const start = new Date(selectedDate);
    const [sh, sm] = startTime.split(':'); start.setHours(parseInt(sh), parseInt(sm));
    const end = new Date(selectedDate);
    const [eh, em] = endTime.split(':'); end.setHours(parseInt(eh), parseInt(em));

    const eventData = {
      title,
      userId: user.uid, // 보안을 위한 유저 아이디 저장
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
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
    } catch (e) { console.error(e); }
  };

  const deleteEvent = async (id: string) => {
    if (confirm('삭제할까요?')) {
      await deleteDoc(doc(db, "events", id));
      closeModal();
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {format(currentDate, view === 'month' ? 'yyyy년 MMMM' : 'M월 W주차', { locale: ko })}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition"><ChevronLeft/></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold bg-slate-800 rounded-lg border border-slate-700">오늘</button>
          <button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition"><ChevronRight/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-4 text-center text-xs font-black text-slate-500">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className={`grid grid-cols-7 flex-1 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl bg-slate-900/20`}>
        {days.map((day, i) => {
          const dayEvents = events.filter(e => isSameDay(e.start, day));
          const isToday = isSameDay(day, new Date());
          return (
            <div 
              key={i}
              onClick={() => { setSelectedDate(day); setIsModalOpen(true); }}
              className={`min-h-[120px] p-2 border-r border-b border-slate-700/30 transition-all cursor-pointer hover:bg-blue-500/5
                ${view === 'month' && !isSameMonth(day, monthStart) ? 'opacity-10' : ''}
                ${isToday ? 'bg-blue-500/10' : ''}
                ${view === 'week' ? 'min-h-[400px]' : ''}`}
            >
              <div className={`text-sm mb-2 font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : 'text-slate-400 text-center'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((event, idx) => (
                  <div 
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingEvent(event);
                      setSelectedDate(event.start);
                      setTitle(event.title);
                      setStartTime(format(event.start, 'HH:mm'));
                      setEndTime(format(event.end, 'HH:mm'));
                      setLocation(event.location || '');
                      setDescription(event.description || '');
                      setColor(event.color || 'blue');
                      setIsModalOpen(true);
                    }}
                    className={`p-1.5 rounded-md text-[10px] font-bold border-l-4 truncate
                      ${event.color === 'green' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200' : 
                        event.color === 'rose' ? 'bg-rose-500/20 border-rose-500 text-rose-200' :
                        event.color === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-200' :
                        event.color === 'violet' ? 'bg-violet-500/20 border-violet-500 text-violet-200' :
                        'bg-blue-500/20 border-blue-500 text-blue-200'}`}
                  >
                    {event.title}
                    {view === 'week' && <div className="text-[8px] opacity-60">{format(event.start, 'HH:mm')}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xl text-white">{editingEvent ? '일정 수정' : '새 일정'}</h3>
                <button onClick={closeModal} className="p-1 hover:bg-slate-800 rounded-full"><X/></button>
              </div>
              <input autoFocus className="w-full bg-transparent text-2xl font-bold focus:outline-none" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex gap-3">
                <div className="flex-1 bg-slate-800 p-3 rounded-2xl">
                  <label className="text-[9px] text-slate-500 font-bold block mb-1">시작</label>
                  <input type="time" className="bg-transparent w-full outline-none" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="flex-1 bg-slate-800 p-3 rounded-2xl">
                  <label className="text-[9px] text-slate-500 font-bold block mb-1">종료</label>
                  <input type="time" className="bg-transparent w-full outline-none" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl">
                <MapPin className="w-4 h-4 text-slate-500" />
                <input className="bg-transparent flex-1 outline-none text-sm" placeholder="장소" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="flex items-start gap-3 bg-slate-800 p-3 rounded-2xl">
                <AlignLeft className="w-4 h-4 text-slate-500 mt-1" />
                <textarea className="bg-transparent flex-1 outline-none text-sm h-20 resize-none" placeholder="메모" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex justify-center gap-3">
                {['blue', 'green', 'amber', 'rose', 'violet'].map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-4 ring-white scale-110' : 'opacity-40'} ${c === 'green' ? 'bg-emerald-500' : c === 'rose' ? 'bg-rose-500' : c === 'amber' ? 'bg-amber-500' : c === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`} />
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                {editingEvent && <button onClick={() => deleteEvent(editingEvent.id)} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl"><Trash2/></button>}
                <button onClick={closeModal} className="flex-1 py-3 font-bold text-slate-400">취소</button>
                <button onClick={saveEvent} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}