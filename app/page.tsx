'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { api } from '../lib/api-client';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import Calendar from '../components/ui/calendar';
import HomeView from '../components/calendar/HomeView';
import TodoView from '../components/calendar/TodoView';
import NotesView from '../components/calendar/NotesView';
import EventListView from '../components/calendar/EventListView';
import GlobalSearch from '../components/calendar/GlobalSearch';
import ImportExportPanel from '../components/calendar/ImportExportPanel';
import TodoModal from '../components/calendar/TodoModal';
import { LogIn, Menu, Search } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'month' | 'week' | 'list' | 'todo' | 'notes'>('today');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setLoading(false); }), []);

  const refreshData = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const [eventsRes, todosRes, notesRes] = await Promise.all([api.events.list(), api.todos.list(), api.notes.list()]);
      setEvents(eventsRes.events.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end), endDate: e.endDate ? new Date(e.endDate) : null, updatedAt: new Date(e.updatedAt) })));
      setTodos(todosRes.todos.map((t: any) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null, createdAt: new Date(t.createdAt) })));
      setNotes(notesRes.notes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt) })));
    } catch (err) { console.error('데이터 조회 실패:', err); }
  }, []);

  useEffect(() => { if (!user) return; refreshData(); const interval = setInterval(refreshData, 30000); return () => clearInterval(interval); }, [user, refreshData]);
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

  const handleLogin = async () => {
    setAuthError(null);
    try { await signInWithPopup(auth, googleProvider); }
    catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return;
      setAuthError(`${error.code || 'unknown'}: ${error.message || error}`);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"/><p className="text-slate-400">안전하게 연결 중입니다...</p></div>;
  if (!user) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center safe-top"><h1 className="text-5xl font-black mb-4 text-white tracking-tighter italic">Cal2do</h1><p className="text-slate-400 mb-10 max-w-xs">기기를 접거나 꺼도 데이터가 안전하게 보관됩니다.</p><button onClick={handleLogin} className="flex items-center gap-4 bg-white text-black px-10 py-5 rounded-2xl font-black shadow-2xl"><LogIn className="w-6 h-6"/> 구글로 시작하기</button>{authError && <p className="mt-6 max-w-xs text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 break-words">로그인 실패: {authError}</p>}</div>;

  const go = (next: typeof view) => { setView(next); setMenuOpen(false); };
  const tabs: Array<[typeof view, string]> = [['today', '오늘'], ['month', '월'], ['week', '주'], ['list', '목록'], ['todo', '할일'], ['notes', '메모']];

  return <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-2">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="메뉴"><Menu className="w-5 h-5" /></button>
        <div className="font-black tracking-tight mr-2 hidden sm:block">Cal2do</div>
        <nav className="flex items-center gap-1 overflow-x-auto flex-1 no-scrollbar">{tabs.map(([key, label]) => <button key={key} onClick={() => go(key)} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${view === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{label}</button>)}</nav>
        <div className="relative w-32 sm:w-48 md:w-64 shrink-0"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색" className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 outline-none text-sm" /></div>
      </div>
    </header>
    {menuOpen && <div className="absolute top-14 left-2 z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
      <button onClick={() => setIsImportExportOpen(true)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">가져오기 / 내보내기</button>
      <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{isDarkMode ? '밝은 모드' : '다크 모드'}</button>
      <button onClick={() => signOut(auth)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">로그아웃</button>
    </div>}
    <main className="max-w-7xl mx-auto p-3 sm:p-5">{search.trim() ? <GlobalSearch query={search} events={events} todos={todos} notes={notes} onEditTodo={setEditingTodo} /> : view === 'today' ? <HomeView events={events} todos={todos} user={user} onNotify={notify} onRefresh={refreshData} /> : view === 'month' ? <Calendar key="month-view" view="month" events={events} user={user} onRefresh={refreshData} onNotify={notify} /> : view === 'week' ? <Calendar key="week-view" view="week" events={events} user={user} onRefresh={refreshData} onNotify={notify} /> : view === 'list' ? <EventListView events={events} user={user} onRefresh={refreshData} onNotify={notify} /> : view === 'todo' ? <TodoView todos={todos} user={user} onNotify={notify} onRefresh={refreshData} /> : <NotesView notes={notes} user={user} onNotify={notify} onRefresh={refreshData} />}</main>
    {isImportExportOpen && <ImportExportPanel user={user} events={events} todos={todos} notes={notes} onClose={() => setIsImportExportOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {editingTodo && <TodoModal todo={editingTodo} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={refreshData} />}
    {toast && <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-sm font-bold ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>{toast.message}</div>}
  </div>;
}
