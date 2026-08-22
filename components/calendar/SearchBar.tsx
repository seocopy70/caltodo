'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { formatTimeKo, formatDateKey } from '@/lib/date-utils';
import type { CalendarEvent } from '@/lib/supabase-client';
import { Search, X } from 'lucide-react';

type Props = {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
};

export default function SearchBar({ events, onEventClick }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = query.trim()
    ? events.filter((e) => {
        const q = query.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="일정 검색..."
          className="pl-9 pr-9 h-9"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {focused && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.map((ev) => {
            const cc = getColorClasses(ev.color);
            const eventDate = new Date(ev.date + 'T00:00:00');
            const dateStr = `${eventDate.getMonth() + 1}월 ${eventDate.getDate()}일`;
            return (
              <button
                key={ev.id}
                onMouseDown={() => onEventClick(ev)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', cc.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{dateStr} · {formatTimeKo(ev.start_time)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
