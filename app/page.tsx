'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, type CalendarEvent, type NewEvent } from '@/lib/supabase-client';
import { useTheme } from '@/lib/use-theme';
import { useEventNotifications } from '@/lib/use-notifications';
import { MONTHS_KO } from '@/lib/date-utils';
import CalendarMonthView from '@/components/calendar/CalendarMonthView';
import CalendarWeekView from '@/components/calendar/CalendarWeekView';
import EventDialog from '@/components/calendar/EventDialog';
import EventList from '@/components/calendar/EventList';
import SearchBar from '@/components/calendar/SearchBar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2, Sun, Moon, Bell, BellOff, LayoutGrid, CalendarDays } from 'lucide-react';

type ViewMode = 'month' | 'week';

export default function CalendarPage() {
  const { theme, toggle } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const { permission, requestPermission } = useEventNotifications(events);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSave = async (event: NewEvent, id?: string) => {
    if (id) {
      const { error } = await supabase
        .from('events')
        .update({ ...event, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('events')
        .insert([event]);
      if (error) throw error;
    }
    await fetchEvents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
    await fetchEvents();
  };

  const handleEventDrop = async (eventId: string, newDate: string) => {
    const { error } = await supabase
      .from('events')
      .update({ date: newDate, updated_at: new Date().toISOString() })
      .eq('id', eventId);
    if (error) {
      setError('일정 이동에 실패했습니다');
      return;
    }
    await fetchEvents();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleAddClick = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const periodLabel = viewMode === 'month'
    ? `${currentDate.getFullYear()}년 ${MONTHS_KO[currentDate.getMonth()]}`
    : `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

  return (
    <div className={`min-h-screen bg-background text-foreground ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-40">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <h1 className="text-base font-semibold tracking-tight">내 캘린더</h1>
            </div>

            <div className="flex items-center gap-1.5">
              {/* View toggle */}
              <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-border/50 p-0.5 mr-1">
                <button
                  onClick={() => setViewMode('month')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    viewMode === 'month' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  월
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    viewMode === 'week' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  주
                </button>
              </div>

              {/* Notification toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={requestPermission}
                className="h-8 w-8"
                title={permission === 'granted' ? '알림 켜짐' : '알림 켜기'}
              >
                {permission === 'granted' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              </Button>

              {/* Theme toggle */}
              <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8" title="테마 전환">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {/* Add event */}
              <Button onClick={handleAddClick} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">새 일정</span>
                <span className="sm:hidden">추가</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          {/* Search bar */}
          <div className="mb-4">
            <SearchBar events={events} onEventClick={handleEventClick} />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Calendar section */}
            <div className="flex flex-col rounded-xl border border-border/50 bg-card/20 p-4 sm:p-6">
              {/* Period navigation */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">{periodLabel}</h2>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={prevPeriod} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">
                    오늘
                  </Button>
                  <Button variant="ghost" size="icon" onClick={nextPeriod} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Mobile view toggle */}
              <div className="mb-3 flex items-center gap-0.5 rounded-lg border border-border/50 p-0.5 sm:hidden">
                <button
                  onClick={() => setViewMode('month')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'month' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  월별
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'week' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  주별
                </button>
              </div>

              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : viewMode === 'month' ? (
                <CalendarMonthView
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  events={events}
                  onDateClick={handleDateClick}
                  onEventClick={handleEventClick}
                  onEventDrop={handleEventDrop}
                />
              ) : (
                <CalendarWeekView
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  events={events}
                  onDateClick={handleDateClick}
                  onEventClick={handleEventClick}
                  onEventDrop={handleEventDrop}
                />
              )}
            </div>

            {/* Event list sidebar */}
            <div className="rounded-xl border border-border/50 bg-card/20 p-4 sm:p-6 lg:max-h-[calc(100vh-160px)]">
              <EventList
                selectedDate={selectedDate}
                events={events}
                onEventClick={handleEventClick}
                onAddClick={handleAddClick}
              />
            </div>
          </div>
        </main>

        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          selectedDate={selectedDate}
          editingEvent={editingEvent}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
