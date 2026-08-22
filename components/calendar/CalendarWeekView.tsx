'use client';

import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { WEEKDAYS_KO, formatDateKey, isSameDay, formatTimeKo } from '@/lib/date-utils';
import type { CalendarEvent } from '@/lib/supabase-client';

type Props = {
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newDate: string) => void;
};

export default function CalendarWeekView({ currentDate, selectedDate, events, onDateClick, onEventClick, onEventDrop }: Props) {
  const today = new Date();
  const dayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - dayOfWeek);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  const hours: number[] = [];
  for (let h = 0; h < 24; h++) hours.push(h);

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const arr = eventsByDate.get(ev.date) || [];
    arr.push(ev);
    eventsByDate.set(ev.date, arr);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border/50 sticky top-0 z-10 bg-card/80 backdrop-blur-sm">
        <div className="border-r border-border/50" />
        {days.map((date, i) => {
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          return (
            <button
              key={i}
              onClick={() => onDateClick(date)}
              className={cn(
                'flex flex-col items-center py-2 transition-colors',
                isSelected && 'bg-foreground/[0.06]',
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">{WEEKDAYS_KO[i]}</span>
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors',
                  isToday
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-foreground',
                )}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-r border-border/30 pr-1 text-right text-[10px] text-muted-foreground/60 pt-1">
                {hour === 0 ? '' : `${hour > 12 ? '오후' : '오전'} ${hour % 12 === 0 ? 12 : hour % 12}`}
              </div>
              {days.map((date, dayIdx) => {
                const key = formatDateKey(date);
                const hourEvents = (eventsByDate.get(key) || [])
                  .filter((e) => parseInt(e.start_time.split(':')[0], 10) === hour)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));

                return (
                  <div
                    key={dayIdx}
                    className="border-b border-r border-border/30 min-h-[44px] p-0.5 relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const eventId = e.dataTransfer.getData('text/plain');
                      if (eventId) onEventDrop(eventId, key);
                    }}
                  >
                    {hourEvents.map((ev) => {
                      const cc = getColorClasses(ev.color);
                      return (
                        <div
                          key={ev.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', ev.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => onEventClick(ev)}
                          className={cn(
                            'cursor-pointer rounded px-1.5 py-1 text-[10px] leading-tight transition-opacity hover:opacity-80',
                            cc.bg, cc.text,
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cc.dot)} />
                            <span className="truncate font-medium">{ev.title}</span>
                          </div>
                          <span className="text-[9px] opacity-70">{formatTimeKo(ev.start_time)}</span>
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
