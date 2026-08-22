'use client';

import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { WEEKDAYS_KO, formatDateKey, formatTimeKo } from '@/lib/date-utils';
import type { CalendarEvent, Todo } from '@/lib/supabase-client';
import { Check } from 'lucide-react';

type Props = {
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  todos: Todo[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onTodoClick: (todo: Todo) => void;
  onEventDrop: (eventId: string, newDate: string) => void;
  onTodoDrop: (todoId: string, newDate: string) => void;
};

export default function CalendarWeekView({ currentDate, selectedDate, events, todos, onDateClick, onEventClick, onTodoClick, onEventDrop, onTodoDrop }: Props) {
  const dayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - dayOfWeek);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const arr = eventsByDate.get(ev.date) || [];
    arr.push(ev);
    eventsByDate.set(ev.date, arr);
  }
  const todosByDate = new Map<string, Todo[]>();
  for (const todo of todos.filter((item) => item.due_date)) {
    const arr = todosByDate.get(todo.due_date as string) || [];
    arr.push(todo);
    todosByDate.set(todo.due_date as string, arr);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border/50 sticky top-0 z-10 bg-card/80 backdrop-blur-sm">
        <div className="border-r border-border/50" />
        {days.map((date, i) => (
          <button key={i} onClick={() => onDateClick(date)} className="flex flex-col items-center py-2 transition-colors hover:bg-foreground/[0.03]">
            <span className="text-xs font-medium text-muted-foreground">{WEEKDAYS_KO[i]}</span>
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm text-foreground">{date.getDate()}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-r border-border/30 pr-1 text-right text-[10px] text-muted-foreground/60 pt-1">
                {hour === 0 ? '' : `${hour > 12 ? '오후' : '오전'} ${hour % 12 === 0 ? 12 : hour % 12}`}
              </div>
              {days.map((date, dayIdx) => {
                const key = formatDateKey(date);
                const hourEvents = (eventsByDate.get(key) || []).filter((e) => parseInt(e.start_time.split(':')[0], 10) === hour);
                const dayTodos = hour === 9 ? (todosByDate.get(key) || []) : [];
                return (
                  <div
                    key={dayIdx}
                    className="border-b border-r border-border/30 min-h-[44px] p-0.5 relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const kind = e.dataTransfer.getData('calendar-item-type');
                      const id = e.dataTransfer.getData('text/plain');
                      if (kind === 'todo' && id) onTodoDrop(id, key);
                      if (kind === 'event' && id) onEventDrop(id, key);
                    }}
                  >
                    {hourEvents.map((ev) => {
                      const cc = getColorClasses(ev.color);
                      return (
                        <div key={ev.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', ev.id); e.dataTransfer.setData('calendar-item-type', 'event'); }} onClick={() => onEventClick(ev)} className={cn('cursor-pointer rounded px-1.5 py-1 text-[10px] leading-tight transition-opacity hover:opacity-80', cc.bg, cc.text)}>
                          <div className="flex items-center gap-1"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cc.dot)} /><span className="truncate font-medium">{ev.title}</span></div>
                          <span className="text-[9px] opacity-70">{formatTimeKo(ev.start_time)}</span>
                        </div>
                      );
                    })}
                    {dayTodos.map((todo) => {
                      const cc = getColorClasses(todo.color);
                      return (
                        <div key={todo.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', todo.id); e.dataTransfer.setData('calendar-item-type', 'todo'); }} onClick={() => onTodoClick(todo)} className={cn('mt-0.5 flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[10px] leading-tight transition-opacity hover:opacity-80', cc.bg, cc.text, todo.completed && 'opacity-50 line-through')}>
                          <Check className="h-2.5 w-2.5 shrink-0" /><span className="truncate font-medium">{todo.title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
