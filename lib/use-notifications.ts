'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { CalendarEvent } from '@/lib/supabase-client';

type NotifiedEvents = Set<string>;

export function useEventNotifications(events: CalendarEvent[]) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const notifiedRef = useRef<NotifiedEvents>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    if (typeof window === 'undefined') return;

    const checkNow = () => {
      const now = new Date();
      const todayKey = formatDateKey(now);
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const ev of events) {
        if (ev.date !== todayKey) continue;
        if (notifiedRef.current.has(ev.id)) continue;

        const diff = timeDiffMinutes(currentTime, ev.start_time);
        if (diff >= 0 && diff <= 1) {
          notifiedRef.current.add(ev.id);
          try {
            new Notification('일정 알림', {
              body: `${ev.title} - ${formatTimeLabel(ev.start_time)}`,
            });
          } catch {
            // notification may fail in some browsers
          }
        }
      }
    };

    checkNow();
    const interval = setInterval(checkNow, 30000);
    return () => clearInterval(interval);
  }, [events, permission]);

  return { permission, requestPermission };
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeDiffMinutes(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return (bh * 60 + bm) - (ah * 60 + am);
}

function formatTimeLabel(t: string) {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? '오후' : '오전';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${ampm} ${display}:${m}`;
}
