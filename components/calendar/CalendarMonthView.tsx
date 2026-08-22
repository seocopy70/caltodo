'use client';

import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { WEEKDAYS_KO, MONTHS_KO, formatDateKey, isSameDay, formatTimeKo } from '@/lib/date-utils';
import type { CalendarEvent } from '@/lib/supabase-client';

type Props = {
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newDate: string) => void;
};

export default function CalendarMonthView({ currentDate, selectedDate, events, onDateClick, onEventClick, onEventDrop }: Props) {
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
    const key = ev.date;
    const arr = eventsByDate.get(key) || [];
    arr.push(ev);
    eventsByDate.set(key, arr);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS_KO.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={i} className="rounded-lg bg-transparent" />;
          }

          const key = formatDateKey(date);
          const dayEvents = (eventsByDate.get(key) || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);

          return (
            <div
              key={i}
              onClick={() => onDateClick(date)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const eventId = e.dataTransfer.getData('text/plain');
                if (eventId) onEventDrop(eventId, key);
              }}
              className={cn(
                'group relative flex flex-col items-start rounded-lg border p-1.5 text-left transition-all duration-150 cursor-pointer',
                'min-h-[72px] sm:min-h-[88px]',
                'hover:border-foreground/20 hover:bg-foreground/[0.03]',
                isSelected
                  ? 'border-foreground/30 bg-foreground/[0.06]'
                  : 'border-border/50 bg-card/30',
              )}
            >
              <span
                className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  isToday
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              >
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
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className={cn(
                        'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight',
                        cc.bg, cc.text,
                        'cursor-pointer hover:opacity-80 transition-opacity',
                      )}
                      title={`${ev.title} (${formatTimeKo(ev.start_time)})`}
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cc.dot)} />
                      <span className="truncate font-medium">{ev.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    외 {dayEvents.length - 3}개
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile month label */}
      <div className="mt-3 text-center text-sm text-muted-foreground sm:hidden">
        {year}년 {MONTHS_KO[month]}
      </div>
    </div>
  );
}
