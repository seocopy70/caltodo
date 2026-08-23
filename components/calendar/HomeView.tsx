'use client';

import { useMemo, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { format, isToday, isPast, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Circle, CheckCircle2, Calendar as CalIcon, MapPin, Repeat, CalendarRange, AlertCircle } from 'lucide-react';
import { withTimeout } from '../../lib/withTimeout';
import { expandOccurrences, getRecurrenceType } from '../../lib/recurrence';
import EventModal from './EventModal';
import TodoModal from './TodoModal';

const RANGE_PAST_DAYS = 7;
const RANGE_FUTURE_DAYS = 60;

export default function HomeView({ events, todos, user, onNotify }: any) {
  const [newTodo, setNewTodo] = useState('');
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState<Date>(new Date());

  const notify = onNotify || (() => {});

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title || !user) return;
    setNewTodo('');
    try {
      await withTimeout(addDoc(collection(db, 'todos'), {
        title,
        userId: user.uid,
        completed: false,
        dueDate: null,
        memo: '',
        createdAt: Timestamp.now(),
      }));
      notify('할 일이 추가되었습니다.');
    } catch (err: any) {
      console.error(err);
      notify(`추가 확인 필요: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    }
  };

  const doToggle = (id: string, completed: boolean) => {
    withTimeout(updateDoc(doc(db, 'todos', id), { completed })).catch((err: any) => {
      console.error(err);
      notify(`업데이트 실패: ${err.isTimeout ? err.message : (err.code || err.message || err)}`, 'error');
    });
  };

  const { dateGroups, noDateTodos, overdueTodos } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = addDays(today, -RANGE_PAST_DAYS);
    const rangeEnd = addDays(today, RANGE_FUTURE_DAYS);

    const groups: Record<string, { date: Date; events: any[]; todos: any[] }> = {};
    const ensureGroup = (d: Date) => {
      const key = format(d, 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = { date: d, events: [], todos: [] };
      return groups[key];
    };

    for (const ev of events) {
      const occurrences = expandOccurrences(ev, rangeStart, rangeEnd);
      for (const occ of occurrences) ensureGroup(occ).events.push(ev);
    }

    const noDate: any[] = [];
    const overdue: any[] = [];

    for (const t of todos) {
      if (!t.dueDate) {
        if (!t.completed) noDate.push(t);
        continue;
      }
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      if (!t.completed && due.getTime() < today.getTime()) {
        overdue.push(t);
        continue;
      }
      if (due.getTime() >= rangeStart.getTime() && due.getTime() <= rangeEnd.getTime()) {
        ensureGroup(due).todos.push(t);
      }
    }

    const sortedKeys = Object.keys(groups).sort();
    const dateGroupsArr = sortedKeys
      .map((k) => groups[k])
      .filter((g) => g.events.length > 0 || g.todos.length > 0)
      .map((g) => ({
        ...g,
        events: [...g.events].sort((a, b) => format(a.start, 'HH:mm').localeCompare(format(b.start, 'HH:mm'))),
      }));

    return { dateGroups: dateGroupsArr, noDateTodos: noDate, overdueTodos: overdue };
  }, [events, todos]);

  const openNewEvent = () => {
    setEditingEvent(null);
    setNewEventDate(new Date());
    setIsEventModalOpen(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-2">
      <form onSubmit={addTodo} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 shadow-xl flex items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-slate-600 shrink-0" />
        <input className="bg-transparent flex-1 outline-none text-base" placeholder="새로운 할 일 추가..." value={newTodo} onChange={(e) => setNewTodo(e.target.value)} />
        <button type="submit" className="p-2.5 bg-blue-600 rounded-xl hover:bg-blue-500 transition shrink-0"><Plus className="w-5 h-5 text-white" /></button>
        <button type="button" onClick={openNewEvent} className="p-2.5 bg-slate-700 rounded-xl hover:bg-slate-600 transition shrink-0" title="새 일정"><CalIcon className="w-5 h-5 text-white" /></button>
      </form>

      {overdueTodos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-rose-400 px-2 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />기한이 지난 할 일</h3>
          <div className="space-y-2">
            {overdueTodos.map((todo: any) => (
              <TodoRow key={todo.id} todo={todo} onToggle={doToggle} onEdit={() => setEditingTodo(todo)} overdue />
            ))}
          </div>
        </section>
      )}

      {noDateTodos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-slate-500 px-2">날짜 없는 할 일</h3>
          <div className="space-y-2">
            {noDateTodos.map((todo: any) => (
              <TodoRow key={todo.id} todo={todo} onToggle={doToggle} onEdit={() => setEditingTodo(todo)} />
            ))}
          </div>
        </section>
      )}

      {dateGroups.length === 0 && overdueTodos.length === 0 && noDateTodos.length === 0 && (
        <div className="text-center text-slate-500 py-16 text-sm">앞으로 예정된 일정이나 할 일이 없어요.</div>
      )}

      <div className="space-y-5">
        {dateGroups.map((group) => {
          const dow = group.date.getDay();
          return (
            <section key={format(group.date, 'yyyy-MM-dd')} className="space-y-2">
              <h3 className={`text-sm font-bold px-2 flex items-center gap-2 ${isToday(group.date) ? 'text-blue-400' : 'text-slate-400'}`}>
                {format(group.date, 'M월 d일 (EEE)', { locale: ko })}
                {isToday(group.date) && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">오늘</span>}
              </h3>
              <div className="space-y-2">
                {group.todos.map((todo: any) => (
                  <TodoRow key={todo.id} todo={todo} onToggle={doToggle} onEdit={() => setEditingTodo(todo)} />
                ))}
                {group.events.map((event: any, idx: number) => {
                  const recurrenceType = getRecurrenceType(event);
                  const isMultiDay = !!event.endDate;
                  return (
                    <div
                      key={idx}
                      onClick={() => setEditingEvent(event)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition hover:border-blue-500/50
                        ${event.color === 'green' ? 'bg-emerald-500/10 border-emerald-500/30' :
                          event.color === 'rose' ? 'bg-rose-500/10 border-rose-500/30' :
                          event.color === 'amber' ? 'bg-amber-500/10 border-amber-500/30' :
                          event.color === 'violet' ? 'bg-violet-500/10 border-violet-500/30' :
                          'bg-blue-500/10 border-blue-500/30'}`}
                    >
                      <div className="text-[11px] font-bold text-slate-400 w-12 shrink-0">{format(event.start, 'HH:mm')}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {recurrenceType !== 'none' && <Repeat className="w-3 h-3 text-slate-500 shrink-0" />}
                          {isMultiDay && <CalendarRange className="w-3 h-3 text-slate-500 shrink-0" />}
                          <p className="font-bold text-sm truncate">{event.title}</p>
                        </div>
                        {event.location && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{event.location}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {editingTodo && <TodoModal todo={editingTodo} notify={notify} onClose={() => setEditingTodo(null)} />}
      {(isEventModalOpen || editingEvent) && (
        <EventModal
          date={newEventDate}
          editingEvent={editingEvent}
          user={user}
          notify={notify}
          onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}

function TodoRow({ todo, onToggle, onEdit, overdue }: any) {
  return (
    <div className={`group flex items-center gap-3 p-3.5 rounded-xl border transition ${overdue ? 'bg-rose-500/5 border-rose-500/30' : 'bg-slate-800/30 border-slate-700/30 hover:border-blue-500/50'}`}>
      <button onClick={() => onToggle(todo.id, !todo.completed)}>
        {todo.completed ? <CheckCircle2 className="w-5 h-5 text-blue-500" /> : <Circle className="w-5 h-5 text-slate-600 hover:text-blue-500" />}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <p className={`text-sm font-medium truncate ${todo.completed ? 'line-through text-slate-500' : ''}`}>{todo.title}</p>
      </div>
      {overdue && <span className="text-[10px] font-bold text-rose-400 shrink-0">{format(todo.dueDate, 'M/d')}</span>}
    </div>
  );
}
