'use client';

import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { WEEKDAYS_FULL_KO, MONTHS_KO, formatTimeKo, formatDateKeyOrNull } from '@/lib/date-utils';
import type { CalendarEvent } from '@/lib/supabase-client';
import { Clock, MapPin, Pencil } from 'lucide-react';

type Props = {
  selectedDate: Date | null;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddClick: () => void;
};

export default function EventList({ selectedDate, events, onEventClick, onAddClick }: Props) {
  const selectedKey = formatDateKeyOrNull(selectedDate);
  const dayEvents = events
    .filter((e) => e.date === selectedKey)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const dateLabel = selectedDate
    ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${WEEKDAYS_FULL_KO[selectedDate.getDay()]}`
    : '날짜를 선택하세요';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{dateLabel}</h2>
          <p className="text-xs text-muted-foreground">
            {dayEvents.length}개 일정
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          + 추가
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {dayEvents.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">예정된 일정이 없습니다</p>
          </div>
        ) : (
          dayEvents.map((ev) => {
            const cc = getColorClasses(ev.color);
            return (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className={cn(
                  'group cursor-pointer rounded-lg border p-3 transition-all duration-150',
                  'hover:border-foreground/20 hover:bg-foreground/[0.03]',
                  cc.border, cc.bg,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-foreground">{ev.title}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeKo(ev.start_time)} – {formatTimeKo(ev.end_time)}</span>
                    </div>
                    {ev.location && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}
                    {ev.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/80">{ev.description}</p>
                    )}
                  </div>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
