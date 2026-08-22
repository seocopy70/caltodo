'use client';

import { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, addDays, subDays
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, MapPin, AlignLeft, Trash2, X, Repeat } from 'lucide-react';
import { getKoreanHolidaysForYears } from '../../lib/holidays';
import { withTimeout } from '../../lib/withTimeout';
import KoreanLunarCalendar from 'korean-lunar-calendar';

function getLunarLabel(date: Date) {
  const cal = new KoreanLunarCalendar();
  cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = cal.getLunarCalendar();
  return `${lunar.intercalation ? '윤' : ''}${lunar.month}.${lunar.day}`;
}

export default function Calendar({ view, events, user, onNotify }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [recurring, setRecurring] = useState(false);

  const notify = onNotify || (() => {});

  const monthStart = startOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({
    start: view === 'month' ? startOfWeek(monthStart) : weekStart,
    end: view === 'month' ? endOfWeek(endOfMonth(monthStart)) : endOfWeek(currentDate),
  });

  const weekOfMonth = Math.ceil((currentDate.getDate() + startOfMonth(currentDate).getDay()) / 7);

  // 표시되는 날짜 범위가 걸친 모든 연도의 공휴일을 미리 계산
  const holidayMap = getKoreanHolidaysForYears(days.map((d) => d.getFullYear()));

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setTitle('');
    setStartTime('09:00');
    setEndTime('10:00');
    setLocation('');
    setDescription('');
    setColor('blue');
    setRecurring(false);
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
      recurring,
      updatedAt: Timestamp.now()
    };

    setIsSaving(true);
    try {
      if (editingEvent) {
        await withTimeout(updateDoc(doc(db, "events", editingEvent.id), eventData));
        notify('일정이 수정되었습니다.');
      } else {
        await withTimeout(addDoc(collection(db, "events"), eventData));
        notify('일정이 추가되었습니다.');
      }
      closeModal();
    } catch (e: any) {
      console.error(e);
      notify(`저장 실패: ${e.isTimeout ? e.message : (e.code || e.message || e)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    setIsSaving(true);
    try {
      await withTimeout(deleteDoc(doc(db, "events", id)));
      notify('일정이 삭제되었습니다.');
      closeModal();
    } catch (e: any) {
      console.error(e);
      notify(`삭제 실패: ${e.isTimeout ? e.message : (e.code || e.message || e)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {view === 'month' ? format(currentDate, 'yyyy년 MMMM', { locale: ko }) : `${format(currentDate, 'M', { locale: ko })}월 ${weekOfMonth}주차`}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subDays(currentDate, 7))} className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition"><ChevronLeft/></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold bg-slate-800 rounded-lg border border-slate-700">오늘</button>
          <button onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))} className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition"><ChevronRight/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-4 text-center text-xs font-black text-slate-500">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : ''}>{d}</div>
        ))}
      </div>

      <div className={`grid grid-cols-7 flex-1 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl bg-slate-900/20`}>
        {days.map((day, i) => {
          const dayEvents = events.filter((e: any) =>
            e.recurring
              ? e.start.getMonth() === day.getMonth() && e.start.getDate() === day.getDate()
              : isSameDay(e.start, day)
          );
          const isToday = isSameDay(day, new Date());
          const dow = day.getDay();
          const dateKey = format(day, 'yyyy-MM-dd');
          const holidayName = holidayMap[dateKey];
          const lunarLabel = getLunarLabel(day);

          const dateColorClass = isToday
            ? ''
            : holidayName || dow === 0
              ? 'text-rose-400'
              : dow === 6
                ? 'text-blue-400'
                : 'text-slate-400';

          return (
            <div 
              key={i}
              onClick={() => { setSelectedDate(day); setIsModalOpen(true); }}
              className={`min-h-[120px] p-2 border-r border-b border-slate-700/30 transition-all cursor-pointer hover:bg-blue-500/5
                ${view === 'month' && !isSameMonth(day, monthStart) ? 'opacity-10' : ''}
                ${isToday ? 'bg-blue-500/10' : ''}
                ${view === 'week' ? 'min-h-[400px]' : ''}`}
            >
              <div className="text-center mb-1">
                <div className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : dateColorClass}`}>
                  {format(day, 'd')}
                </div>
                <div className="text-[9px] text-slate-600 leading-tight">{lunarLabel}</div>
                {holidayName && (
                  <div className="text-[9px] text-rose-400 font-bold truncate leading-tight">{holidayName}</div>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((event: any, idx: number) => (
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
                      setRecurring(!!event.recurring);
                      setIsModalOpen(true);
                    }}
                    className={`p-1.5 rounded-md text-[10px] font-bold border-l-4 truncate flex items-center gap-1
                      ${event.color === 'green' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200' : 
                        event.color === 'rose' ? 'bg-rose-500/20 border-rose-500 text-rose-200' :
                        event.color === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-200' :
                        event.color === 'violet' ? 'bg-violet-500/20 border-violet-500 text-violet-200' :
                        'bg-blue-500/20 border-blue-500 text-blue-200'}`}
                  >
                    {event.recurring && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                    <span className="truncate">{event.title}</span>
                    {view === 'week' && !event.recurring && <div className="text-[8px] opacity-60">{format(event.start, 'HH:mm')}</div>}
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
              <label className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl cursor-pointer">
                <Repeat className="w-4 h-4 text-slate-500" />
                <span className="flex-1 text-sm">매년 반복 (생일·기념일)</span>
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              </label>
              <div className="flex justify-center gap-3">
                {['blue', 'green', 'amber', 'rose', 'violet'].map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-4 ring-white scale-110' : 'opacity-40'} ${c === 'green' ? 'bg-emerald-500' : c === 'rose' ? 'bg-rose-500' : c === 'amber' ? 'bg-amber-500' : c === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`} />
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                {editingEvent && <button disabled={isSaving} onClick={() => deleteEvent(editingEvent.id)} className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl disabled:opacity-40"><Trash2/></button>}
                <button disabled={isSaving} onClick={closeModal} className="flex-1 py-3 font-bold text-slate-400 disabled:opacity-40">취소</button>
                <button disabled={isSaving} onClick={saveEvent} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold disabled:opacity-60">
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
