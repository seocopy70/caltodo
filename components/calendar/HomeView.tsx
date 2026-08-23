'use client';

import { useMemo, useState } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Circle, CheckCircle2, Calendar as CalIcon, MapPin, Repeat, CalendarRange, CalendarClock } from 'lucide-react';
import { eventOccursOnDay, getRecurrenceType } from '../../lib/recurrence';
import EventModal from './EventModal';
import TodoModal from './TodoModal';
import { api } from '../../lib/api-client';

export default function HomeView({ events, todos, user, onNotify, onRefresh }: any) {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const notify = onNotify || (() => {});

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title || !user) return;
    setNewTodo(''); setDueDate('');
    try {
      await api.todos.create({ title, completed: false, dueDate: dueDate ? new Date(dueDate).toISOString() : null, memo: '' });
      notify('할 일이 추가되었습니다.'); onRefresh?.();
    } catch (err: any) { notify(`추가 실패: ${err.message || err}`, 'error'); }
  };

  const toggleTodo = (id: string, completed: boolean) => api.todos.update(id, { completed }).then(() => onRefresh?.()).catch((err: any) => notify(`업데이트 실패: ${err.message || err}`, 'error'));

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayGroups = useMemo(() => [today, tomorrow].map((day) => ({
    date: day,
    events: events.filter((e: any) => eventOccursOnDay(e, day)).sort((a: any, b: any) => a.start.getTime() - b.start.getTime()),
    todos: todos.filter((t: any) => !t.completed && t.dueDate && format(t.dueDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
  })), [events, todos]);

  const noDateTodos = todos.filter((t: any) => !t.completed && !t.dueDate).sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <div className="max-w-5xl mx-auto space-y-5 p-2">
      <form onSubmit={addTodo} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 shadow-xl">
        <div className="flex items-center gap-3">
          <Circle className="w-5 h-5 text-slate-600 shrink-0" />
          <input className="bg-transparent flex-1 outline-none" placeholder="새로운 할 일 추가..." value={newTodo} onChange={(e) => setNewTodo(e.target.value)} />
          <button type="submit" className="p-2.5 bg-blue-600 rounded-xl"><Plus className="w-5 h-5 text-white" /></button>
          <button type="button" onClick={() => setIsEventModalOpen(true)} className="p-2.5 bg-slate-700 rounded-xl" title="새 일정"><CalIcon className="w-5 h-5 text-white" /></button>
        </div>
        <div className="flex items-center gap-2 pl-8 pt-2 text-xs text-slate-500">
          <CalendarClock className="w-4 h-4" />
          <span>할 일 기한</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-transparent outline-none" />
          {dueDate && <button type="button" onClick={() => setDueDate('')} className="text-[10px]">지우기</button>}
        </div>
      </form>

      <div className="grid md:grid-cols-2 gap-5">
        {dayGroups.map((group) => (
          <section key={format(group.date, 'yyyy-MM-dd')} className="rounded-2xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
            <div className={`px-5 py-4 border-b border-slate-700/50 font-black ${isToday(group.date) ? 'text-blue-400' : 'text-violet-400'}`}>
              {format(group.date, 'M월 d일 (EEE)', { locale: ko })}
              {isToday(group.date) && <span className="ml-2 text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded">오늘</span>}
            </div>
            <div className="p-3 space-y-2">
              {group.todos.map((todo: any) => <TodoRow key={`t-${todo.id}`} todo={todo} onToggle={toggleTodo} onEdit={() => setEditingTodo(todo)} />)}
              {group.events.map((event: any) => <EventRow key={`e-${event.id}`} event={event} onEdit={() => setEditingEvent(event)} />)}
              {group.todos.length === 0 && group.events.length === 0 && <div className="text-center text-slate-600 py-8 text-sm">일정과 할 일이 없습니다.</div>}
            </div>
          </section>
        ))}
      </div>

      {noDateTodos.length > 0 && <section className="rounded-2xl border border-slate-700/50 bg-slate-900/20 p-4">
        <h3 className="text-sm font-bold text-slate-500 mb-3">기한 없는 할 일</h3>
        <div className="space-y-2">{noDateTodos.map((todo: any) => <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onEdit={() => setEditingTodo(todo)} />)}</div>
      </section>}

      {editingTodo && <TodoModal todo={editingTodo} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={onRefresh} />}
      {(isEventModalOpen || editingEvent) && <EventModal date={new Date()} editingEvent={editingEvent} user={user} notify={notify} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} onRefresh={onRefresh} />}
    </div>
  );
}

function EventRow({ event, onEdit }: any) {
  const repeated = getRecurrenceType(event) !== 'none';
  const multi = !!event.endDate;
  return <div onClick={onEdit} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${repeated ? 'bg-violet-500/10 border-violet-500/35' : 'bg-blue-500/5 border-slate-700/50'}`}>
    <div className="w-12 text-[11px] font-bold text-slate-400">{format(event.start, 'HH:mm')}</div>
    <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5">{repeated && <Repeat className="w-3 h-3 text-violet-400"/>}{multi && <CalendarRange className="w-3 h-3 text-slate-500"/>}<span className="font-bold text-sm truncate">{event.title}</span></div>{event.location && <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/>{event.location}</div>}</div>
  </div>;
}

function TodoRow({ todo, onToggle, onEdit }: any) {
  return <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/30 bg-slate-800/20"><button onClick={() => onToggle(todo.id, true)}><Circle className="w-5 h-5 text-slate-600 hover:text-blue-500"/></button><div onClick={onEdit} className="flex-1 cursor-pointer min-w-0"><span className="font-medium text-sm truncate block">{todo.title}</span></div>{todo.dueDate && <span className="text-[10px] text-slate-500">{format(todo.dueDate, 'M/d')}</span>}</div>;
}
