'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import Calendar from '../components/ui/calendar';
import HomeView from '../components/calendar/HomeView';
import TodoView from '../components/calendar/TodoView';
import NotesView from '../components/calendar/NotesView';
import EventListView from '../components/calendar/EventListView';
import GlobalSearch from '../components/calendar/GlobalSearch';
import ImportExportPanel from '../components/calendar/ImportExportPanel';
import TodoModal from '../components/calendar/TodoModal';
import { LogOut, LogIn, Sun, Moon, Upload, Menu, X, Search, Download } from 'lucide-react';

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
  if (!user) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center safe-top"><h1 className="text-5xl font-black mb-4 text-white tracking-tighter italic">CalTodo</h1><p className="text-slate-400 mb-10 max-w-xs">기기를 접거나 꺼도 데이터가 안전하게 보관됩니다.</p><button onClick={handleLogin} className="flex items-center gap-4 bg-white text-black px-10 py-5 rounded-2xl font-black shadow-2xl"><LogIn className="w-6 h-6"/> 구글로 시작하기</button>{authError && <p className="mt-6 max-w-xs text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 break-words">로그인 실패: {authError}</p>}</div>;

  const go = (next: typeof view) => { setView(next); setMenuOpen(false); };

  const tabs: Array<[typeof view, string]> = [
    ['today', '오늘'],
    ['month', '월'],
    ['week', '주'],
    ['list', '목록'],
    ['todo', '할일'],
    ['notes', '메모'],
  ];

  const handleSearchEvent = () => { setSearch(''); setView('month'); };

  return (
    <main className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`safe-top sticky top-0 z-50 border-b backdrop-blur-md ${isDarkMode ? 'border-slate-700 bg-[#0f172a]/95' : 'border-gray-200 bg-white/95'}`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 pt-2">
          <div className="flex items-center gap-1.5 sm:gap-3 min-h-11">
            <button onClick={() => setMenuOpen(true)} className="p-2 rounded-xl hover:bg-slate-800/60 shrink-0" aria-label="메뉴">
              <Menu className="w-5 h-5" />
            </button>
            <button onClick={() => go('today')} className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent shrink-0">
              CalTodo
            </button>
            <div className="relative flex-1 min-w-0 max-w-2xl mx-auto">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="일정 · 할 일 · 메모 검색"
                className={`w-full rounded-lg sm:rounded-xl pl-8 sm:pl-9 pr-2 sm:pr-4 py-2 text-xs sm:text-sm outline-none border ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'}`}
              />
              <GlobalSearch
                query={search}
                events={events}
                todos={todos}
                notes={notes}
                onClose={() => setSearch('')}
                onEvent={handleSearchEvent}
                onTodo={(t: any) => { setSearch(''); setEditingTodo(t); }}
                onNote={() => { setSearch(''); setView('notes'); }}
              />
            </div>
          </div>

          <div className="mt-1.5 pb-2 overflow-x-auto scrollbar-hide">
            <nav className="flex items-center gap-1 min-w-max">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                    view === key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDarkMode
                        ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setMenuOpen(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute left-0 top-0 h-full w-[min(82vw,320px)] p-5 pt-16 shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'}`}
          >
            <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 p-2"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-black mb-5">CalTodo 메뉴</h2>
            <div className="space-y-2">
              <button onClick={() => { setIsImportExportOpen(true); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold hover:bg-slate-800/70">
                <Download className="w-5 h-5 text-blue-400" /> 가져오기 / 내보내기
              </button>
              <button onClick={() => { setIsDarkMode((v) => !v); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold hover:bg-slate-800/70">
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-500" />}
                {isDarkMode ? '밝은 모드' : '다크 모드'}
              </button>
              <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-rose-500 hover:bg-rose-500/10">
                <LogOut className="w-5 h-5" /> 로그아웃
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="p-2 sm:p-4 max-w-7xl mx-auto">
        {view === 'today' && <HomeView events={events} todos={todos} user={user} onNotify={notify} onRefresh={refreshData} />}
        {view === 'todo' && <TodoView todos={todos} user={user} onNotify={notify} onRefresh={refreshData} />}
        {view === 'notes' && <NotesView notes={notes} user={user} onNotify={notify} onRefresh={refreshData} />}
        {view === 'list' && <EventListView events={events} user={user} onNotify={notify} onRefresh={refreshData} />}
        {(view === 'month' || view === 'week') && <Calendar view={view} events={events} user={user} onNotify={notify} onRefresh={refreshData} />}
      </div>

      {isImportExportOpen && <ImportExportPanel events={events} todos={todos} notes={notes} user={user} onNotify={notify} onRefresh={refreshData} onClose={() => setIsImportExportOpen(false)} />}
      {editingTodo && <TodoModal todo={editingTodo} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={refreshData} />}
      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-5 py-3 rounded-xl shadow-2xl text-sm font-bold text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{toast.message}</div>}
    </main>
  );
}
