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
import EmailBackupPanel from '../components/calendar/EmailBackupPanel';
import DataManagementPanel from '../components/calendar/DataManagementPanel';
import AnniversaryModal from '../components/calendar/AnniversaryModal';
import TodoModal from '../components/calendar/TodoModal';
import NoteModal from '../components/calendar/NoteModal';
import VersionModal from '../components/calendar/VersionModal';
import HelpModal from '../components/calendar/HelpModal';
import { LogIn, Menu, Search, CalendarSearch } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'calendar' | 'list' | 'todo' | 'notes'>('today');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteFolders, setNoteFolders] = useState<any[]>([]);
  const [todoFolders, setTodoFolders] = useState<any[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isEmailBackupOpen, setIsEmailBackupOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isAnniversaryOpen, setIsAnniversaryOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const searchDateRef = useRef<HTMLInputElement>(null);
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [editingNoteFocus, setEditingNoteFocus] = useState<{ focus: 'title' | 'content'; lineIndex?: number } | null>(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const hscrollElRef = useRef<HTMLElement | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setLoading(false); }), []);

  // 텍스트 입력창이 아닌 곳(할일/일정/메모 카드 등)을 길게 눌렀을 때 뜨는 네이티브 복사/공유 컨텍스트 메뉴 차단.
  // 입력창/textarea/contenteditable 안에서는 그대로 둬서 붙여넣기·선택은 정상 동작하게 함.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  const refreshData = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const res = await api.bootstrap();
      setEvents(res.events.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end), endDate: e.endDate ? new Date(e.endDate) : null, updatedAt: new Date(e.updatedAt) })));
      setTodos(res.todos.map((t: any) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null, completedAt: t.completedAt ? new Date(t.completedAt) : null, createdAt: new Date(t.createdAt) })));
      setNotes(res.notes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt), deletedAt: n.deletedAt ? new Date(n.deletedAt) : null })));
      setNoteFolders(res.noteFolders || []);
      setTodoFolders(res.todoFolders || []);
    } catch (err) { console.error('데이터 조회 실패:', err); }
  }, []);

  // 낙관적 로컬 업데이트: 서버 응답을 기다리지 않고 화면에 즉시 반영해 체감 반응속도를 높임
  const patchTodoLocal = useCallback((id: string, patch: any) => setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);
  const removeTodoLocal = useCallback((id: string) => setTodos((prev) => prev.filter((t) => t.id !== id)), []);
  const patchNoteLocal = useCallback((id: string, patch: any) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n))), []);

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
  // 목록 탭은 메인메뉴로 이동했으므로 탭바/스와이프 순환에서는 제외 (view 상태 자체는 유지)
  const tabs: Array<[typeof view, string]> = [['today', '오늘'], ['calendar', '일정'], ['todo', '할일'], ['notes', '메모']];
  const activeNotes = notes.filter((n: any) => !n.deletedAt);
  const todayNotes = activeNotes.filter((n: any) => n.showToday);
  const anyOverlayOpen = menuOpen || isImportExportOpen || isEmailBackupOpen || isDataManagementOpen || isVersionOpen || isHelpOpen || !!editingTodo || !!editingNote || isNewNoteOpen || !!search.trim() || !!searchDate;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    // 일정표(월/주별보기) 영역 안이면 해당 스크롤 요소를 기억해뒀다가, 끝에 도달한 상태에서
    // 그 방향으로 더 밀었을 때만 탭 순환으로 이어지도록 함
    hscrollElRef.current = (e.target as HTMLElement).closest('[data-hscroll]') as HTMLElement | null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || anyOverlayOpen) { touchStartX.current = null; touchStartY.current = null; return; }
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // 위아래로 스크롤하려던 움직임이 옆으로 살짝 밀렸다고 탭이 바뀌지 않도록,
    // 가로로 움직인 거리가 세로보다 뚜렷하게 클 때만(가로가 세로의 1.5배 이상) 스와이프로 인정
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    const grid = hscrollElRef.current;
    hscrollElRef.current = null;
    if (grid) {
      // 왼쪽으로 밀 때(다음 탭 방향)는 그리드가 이미 오른쪽 끝까지 스크롤된 상태여야 하고,
      // 오른쪽으로 밀 때(이전 탭 방향)는 이미 왼쪽 끝(scrollLeft 0)이어야 함
      const atRightEdge = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 1;
      const atLeftEdge = grid.scrollLeft <= 1;
      const atRelevantEdge = deltaX < 0 ? atRightEdge : atLeftEdge;
      if (!atRelevantEdge) return; // 아직 스크롤할 여지가 있으면 탭 순환은 무시하고 그리드 스크롤만
    }

    // 화면 폭의 1/4 이상 밀었을 때만 탭 순환 (짧은 밀기는 무시)
    const threshold = window.innerWidth / 4;
    if (Math.abs(deltaX) < threshold) return;
    const idx = tabs.findIndex(([key]) => key === view);
    if (idx === -1) return;
    // 왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭
    const nextIdx = deltaX < 0 ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    setView(tabs[nextIdx][0]);
  };

  return <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0" aria-label="메뉴"><Menu className="w-5 h-5" /></button>
          <div className="font-black tracking-tight mr-1 hidden sm:block">Cal2do</div>
          <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 no-scrollbar">{tabs.map(([key, label]) => <button key={key} onClick={() => go(key)} className={`px-2.5 py-1.5 rounded-lg text-base font-black whitespace-nowrap ${view === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{label}</button>)}</nav>
        </div>
        <div className="relative w-full sm:w-48 md:w-64 shrink-0 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400"/>
            <input value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) setSearchDate(''); }} placeholder="검색" className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 outline-none text-sm" />
          </div>
          <button
            type="button"
            onClick={() => searchDateRef.current?.showPicker?.() || searchDateRef.current?.focus()}
            title="날짜로 전체 기록 보기"
            className={`p-2 rounded-lg shrink-0 transition ${searchDate ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <CalendarSearch className="w-4 h-4" />
          </button>
          <input
            ref={searchDateRef}
            type="date"
            value={searchDate}
            onChange={(e) => { setSearchDate(e.target.value); if (e.target.value) setSearch(''); }}
            className="sr-only"
          />
          {(search.trim() || searchDate) && (
            <GlobalSearch
              query={search}
              date={searchDate ? new Date(searchDate) : null}
              events={events}
              todos={todos}
              notes={activeNotes}
              folders={noteFolders}
              onClose={() => { setSearch(''); setSearchDate(''); }}
              onEvent={() => { setSearch(''); setSearchDate(''); setView('list'); }}
              onTodo={(t: any) => { setSearch(''); setSearchDate(''); setEditingTodo(t); }}
              onNote={(n: any) => { setSearch(''); setSearchDate(''); setEditingNote(n); }}
              onRefresh={refreshData}
              onNotify={notify}
            />
          )}
        </div>
      </div>
    </header>
    {menuOpen && <>
      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      <div className="absolute top-14 left-2 z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
        <button onClick={() => { setIsImportExportOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">가져오기 / 내보내기</button>
        <button onClick={() => { setIsEmailBackupOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">이메일 백업</button>
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button onClick={() => go('list')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">일정 목록 보기</button>
        <button onClick={() => { setIsDataManagementOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">일정데이터 관리</button>
        <button onClick={() => { setIsAnniversaryOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">기념일 관리</button>
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{isDarkMode ? '밝은 모드' : '다크 모드'}</button>
        <button onClick={() => { setIsHelpOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">도움말</button>
        <button onClick={() => { setIsVersionOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">버전 정보</button>
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button onClick={() => signOut(auth)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">로그아웃</button>
      </div>
    </>}
    <main className="max-w-7xl mx-auto p-2.5 sm:p-4">{view === 'today' ? <HomeView events={events} todos={todos} notes={todayNotes} todoFolders={todoFolders} user={user} onNotify={notify} onRefresh={refreshData} onPatchTodo={patchTodoLocal} onRemoveTodo={removeTodoLocal} onNewNote={() => setIsNewNoteOpen(true)} onEditNote={(n: any) => setEditingNote(n)} /> : view === 'calendar' ? <Calendar key="calendar-view" events={events} user={user} onRefresh={refreshData} onNotify={notify} /> : view === 'list' ? <EventListView events={events} user={user} onRefresh={refreshData} onNotify={notify} /> : view === 'todo' ? <TodoView todos={todos} folders={todoFolders} user={user} onNotify={notify} onRefresh={refreshData} onPatchTodo={patchTodoLocal} onRemoveTodo={removeTodoLocal} /> : <NotesView notes={notes} folders={noteFolders} user={user} onNotify={notify} onRefresh={refreshData} onNewNote={() => setIsNewNoteOpen(true)} onEditNote={(n: any, focus?: 'title' | 'content', lineIndex?: number) => { setEditingNote(n); setEditingNoteFocus({ focus: focus || 'title', lineIndex }); }} onPatchNote={patchNoteLocal} />}</main>
    {isImportExportOpen && <ImportExportPanel user={user} events={events} todos={todos} notes={activeNotes} folders={noteFolders} todoFolders={todoFolders} onClose={() => setIsImportExportOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {isEmailBackupOpen && <EmailBackupPanel user={user} onClose={() => setIsEmailBackupOpen(false)} onNotify={notify} />}
    {isDataManagementOpen && <DataManagementPanel events={events} user={user} onClose={() => setIsDataManagementOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {isAnniversaryOpen && <AnniversaryModal events={events} user={user} onClose={() => setIsAnniversaryOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {isVersionOpen && <VersionModal onClose={() => setIsVersionOpen(false)} />}
    {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
    {editingTodo && <TodoModal todo={editingTodo} folders={todoFolders} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={refreshData} />}
    {(editingNote || isNewNoteOpen) && <NoteModal note={editingNote} folders={noteFolders} secureFolderId={noteFolders.find((f: any) => f.isSecure)?.id || null} initialFocus={editingNoteFocus?.focus} initialLineIndex={editingNoteFocus?.lineIndex} onClose={() => { setEditingNote(null); setIsNewNoteOpen(false); setEditingNoteFocus(null); }} onRefresh={refreshData} onNotify={notify} />}
    {toast && <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-sm font-bold ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>{toast.message}</div>}
  </div>;
}
