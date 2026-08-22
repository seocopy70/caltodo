'use client';

import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { WEEKDAYS_KO, MONTHS_KO, formatDateKey, isSameDay } from '@/lib/date-utils';
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

export default function CalendarMonthView({ currentDate, selectedDate, events, todos, onDateClick, onEventClick, onTodoClick, onEventDrop, onTodoDrop }: Props) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

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
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS_KO.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="rounded-lg bg-transparent" />;

          const key = formatDateKey(date);
          const dayEvents = (eventsByDate.get(key) || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
          const dayTodos = (todosByDate.get(key) || []).sort((a, b) => Number(a.completed) - Number(b.completed));
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);

          return (
            <div
              key={i}
              onClick={() => onDateClick(date)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const kind = e.dataTransfer.getData('calendar-item-type');
                const id = e.dataTransfer.getData('text/plain');
                if (kind === 'todo' && id) onTodoDrop(id, key);
                if (kind === 'event' && id) onEventDrop(id, key);
              }}
              className={cn(
                'group relative flex flex-col items-start rounded-lg border p-1.5 text-left transition-all duration-150 cursor-pointer min-h-[72px] sm:min-h-[88px]',
                'hover:border-foreground/20 hover:bg-foreground/[0.03]',
                isSelected ? 'border-foreground/30 bg-foreground/[0.06]' : 'border-border/50 bg-card/30',
              )}
            >
              <span className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors', isToday ? 'bg-foreground text-background font-semibold' : 'text-muted-foreground group-hover:text-foreground')}>
                {date.getDate()}
              </span>

              <div className="flex w-full flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => {
                  const cc = getColorClasses(ev.color);
                  return (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', ev.id);
                        e.dataTransfer.setData('calendar-item-type', 'event');
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className={cn('flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight cursor-pointer hover:opacity-80 transition-opacity', cc.bg, cc.text)}
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cc.dot)} />
                      <span className="truncate font-medium">{ev.title}</span>
                    </div>
                  );
                })}
                {dayTodos.slice(0, 3).map((todo) => {
                  const cc = getColorClasses(todo.color);
                  return (
                    <div
                      key={todo.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', todo.id);
                        e.dataTransfer.setData('calendar-item-type', 'todo');
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => { e.stopPropagation(); onTodoClick(todo); }}
                      className={cn('flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight cursor-pointer hover:opacity-80 transition-opacity', cc.bg, cc.text, todo.completed && 'opacity-50 line-through')}
                    >
                      <Check className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate font-medium">{todo.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length + dayTodos.length > 3 && (
                  <span className="px-1 text-[10px] text-muted-foreground">외 {dayEvents.length + dayTodos.length - 3}개</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-center text-sm text-muted-foreground sm:hidden">{year}년 {MONTHS_KO[month]}</div>
    </div>
  );
}
