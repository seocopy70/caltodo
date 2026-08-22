'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, type CalendarEvent, type NewEvent, type Todo, type NewTodo } from '@/lib/supabase-client';
import { useTheme } from '@/lib/use-theme';
import { useEventNotifications } from '@/lib/use-notifications';
import { MONTHS_KO } from '@/lib/date-utils';
import CalendarMonthView from '@/components/calendar/CalendarMonthView';
import CalendarWeekView from '@/components/calendar/CalendarWeekView';
import EventDialog from '@/components/calendar/EventDialog';
import EventList from '@/components/calendar/EventList';
import TodoDialog from '@/components/calendar/TodoDialog';
import TodoView from '@/components/calendar/TodoView';
import SearchBar from '@/components/calendar/SearchBar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2, Sun, Moon, Bell, BellOff, LayoutGrid, CalendarDays, ListTodo } from 'lucide-react';

type ViewMode = 'month' | 'week' | 'todo';

export default function CalendarPage() {
  const { theme, toggle } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const { permission, requestPermission } = useEventNotifications(events);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsResponse, todosResponse] = await Promise.all([
        supabase.from('events').select('*').order('start_time', { ascending: true }),
        supabase.from('todos').select('*').order('created_at', { ascending: true }),
      ]);
      if (eventsResponse.error) throw eventsResponse.error;
      if (todosResponse.error) throw todosResponse.error;
      setEvents(eventsResponse.data || []);
      setTodos(todosResponse.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (event: NewEvent, id?: string) => {
    const result = id
      ? await supabase.from('events').update({ ...event, updated_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('events').insert([event]);
    if (result.error) throw result.error;
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from('events').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await fetchData();
  };

  const handleSaveTodo = async (todo: NewTodo, id?: string) => {
    const result = id
      ? await supabase.from('todos').update({ ...todo, updated_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('todos').insert([todo]);
    if (result.error) throw result.error;
    await fetchData();
  };

  const handleDeleteTodo = async (id: string) => {
    const { error: deleteError } = await supabase.from('todos').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await fetchData();
  };

  const handleToggleTodo = async (todo: Todo) => {
    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed: !todo.completed, updated_at: new Date().toISOString() })
      .eq('id', todo.id);
    if (updateError) setError('할일 상태를 변경하지 못했습니다');
    else await fetchData();
  };

  const handleEventDrop = async (eventId: string, newDate: string) => {
    const { error: updateError } = await supabase.from('events').update({ date: newDate, updated_at: new Date().toISOString() }).eq('id', eventId);
    if (updateError) setError('일정 이동에 실패했습니다');
    else await fetchData();
  };

  const handleTodoDrop = async (todoId: string, newDate: string) => {
    const { error: updateError } = await supabase.from('todos').update({ due_date: newDate, updated_at: new Date().toISOString() }).eq('id', todoId);
    if (updateError) setError('할일 이동에 실패했습니다');
    else await fetchData();
  };

  const handleDateClick = (date: Date) => setSelectedDate(date);
  const handleEventClick = (event: CalendarEvent) => { setEditingEvent(event); setDialogOpen(true); };
  const handleTodoClick = (todo: Todo) => { setEditingTodo(todo); setTodoDialogOpen(true); };
  const handleAddClick = () => { setEditingEvent(null); setDialogOpen(true); };
  const handleAddTodoClick = () => { setEditingTodo(null); setTodoDialogOpen(true); };

  const prevPeriod = () => {
    if (viewMode === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else if (viewMode === 'week') { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }
  };
  const nextPeriod = () => {
    if (viewMode === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    else if (viewMode === 'week') { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }
  };
  const goToToday = () => { const today = new Date(); setCurrentDate(today); setSelectedDate(today); };
  const periodLabel = viewMode === 'month' ? `${currentDate.getFullYear()}년 ${MONTHS_KO[currentDate.getMonth()]}` : `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

  const viewButton = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button onClick={() => setViewMode(mode)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${viewMode === mode ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
      {icon}{label}
    </button>
  );

  return (
    <div className={`min-h-screen bg-background text-foreground ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <header className="sticky top-0 z-40 border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background"><CalendarIcon className="h-4 w-4" /></div><h1 className="text-base font-semibold tracking-tight">내 캘린더</h1></div>
            <div className="flex items-center gap-1.5">
              <div className="hidden items-center gap-0.5 rounded-lg border border-border/50 p-0.5 mr-1 sm:flex">
                {viewButton('month', <LayoutGrid className="h-3.5 w-3.5" />, '월')}
                {viewButton('week', <CalendarDays className="h-3.5 w-3.5" />, '주')}
                {viewButton('todo', <ListTodo className="h-3.5 w-3.5" />, '할일')}
              </div>
              <Button variant="ghost" size="icon" onClick={requestPermission} className="h-8 w-8" title={permission === 'granted' ? '알림 켜짐' : '알림 켜기'}>{permission === 'granted' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}</Button>
              <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8" title="테마 전환">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
              <Button onClick={viewMode === 'todo' ? handleAddTodoClick : handleAddClick} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /><span className="hidden sm:inline">{viewMode === 'todo' ? '새 할일' : '새 일정'}</span><span className="sm:hidden">추가</span></Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-4"><SearchBar events={events} onEventClick={handleEventClick} /></div>
          {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
            <div className="flex flex-col rounded-xl border border-border/50 bg-card/20 p-4 sm:p-6">
              {viewMode === 'todo' ? (
                <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold tracking-tight">할일 목록</h2><Button variant="ghost" size="sm" onClick={handleAddTodoClick} className="gap-1 text-xs"><Plus className="h-3.5 w-3.5" />할일 추가</Button></div>
              ) : (
                <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold tracking-tight">{periodLabel}</h2><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={prevPeriod} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">오늘</Button><Button variant="ghost" size="icon" onClick={nextPeriod} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button></div></div>
              )}

              <div className="mb-3 flex items-center gap-0.5 rounded-lg border border-border/50 p-0.5 sm:hidden">
                {viewButton('month', <LayoutGrid className="h-3.5 w-3.5" />, '월별')}{viewButton('week', <CalendarDays className="h-3.5 w-3.5" />, '주별')}{viewButton('todo', <ListTodo className="h-3.5 w-3.5" />, '할일')}
              </div>

              {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : viewMode === 'todo' ? (
                <TodoView todos={todos} selectedDate={selectedDate} onToggle={handleToggleTodo} onEdit={handleTodoClick} onAddClick={handleAddTodoClick} />
              ) : viewMode === 'month' ? (
                <CalendarMonthView currentDate={currentDate} selectedDate={selectedDate} events={events} todos={todos} onDateClick={handleDateClick} onEventClick={handleEventClick} onTodoClick={handleTodoClick} onEventDrop={handleEventDrop} onTodoDrop={handleTodoDrop} />
              ) : (
                <CalendarWeekView currentDate={currentDate} selectedDate={selectedDate} events={events} todos={todos} onDateClick={handleDateClick} onEventClick={handleEventClick} onTodoClick={handleTodoClick} onEventDrop={handleEventDrop} onTodoDrop={handleTodoDrop} />
              )}
            </div>

            <div className="rounded-xl border border-border/50 bg-card/20 p-4 sm:p-6 lg:max-h-[calc(100vh-160px)]">
              {viewMode === 'todo' ? <TodoView todos={todos} selectedDate={selectedDate} onToggle={handleToggleTodo} onEdit={handleTodoClick} onAddClick={handleAddTodoClick} /> : <EventList selectedDate={selectedDate} events={events} onEventClick={handleEventClick} onAddClick={handleAddClick} />}
            </div>
          </div>
        </main>

        <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} selectedDate={selectedDate} editingEvent={editingEvent} onSave={handleSave} onDelete={handleDelete} />
        <TodoDialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen} editingTodo={editingTodo} onSave={handleSaveTodo} onDelete={handleDeleteTodo} />
      </div>
    </div>
  );
}
