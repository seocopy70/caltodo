'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { api } from '../lib/api-client';
import { autoPriorityForDueDate } from '../lib/todoAutoColor';
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
import TodoEventLinkSettingsModal from '../components/calendar/TodoEventLinkSettingsModal';
import TodoModal from '../components/calendar/TodoModal';
import NoteModal from '../components/calendar/NoteModal';
import VersionModal from '../components/calendar/VersionModal';
import HelpModal from '../components/calendar/HelpModal';
import { LogIn, Menu, Search, CalendarSearch } from 'lucide-react';
import { ModalBackCloseGuard, isAnyModalOpen } from '../lib/useModalBackClose';

// 앱을 다시 열었을 때 "빈 오늘탭 → 잠시 후 데이터로 채워짐"으로 깜빡이는 대신, 지난번에 불러온
// 데이터를 즉시 화면에 먼저 보여주고(약간 오래된 상태일 수 있음) 그 사이 서버에서 최신 데이터를
// 가져와 조용히 덮어쓴다. 로그인 계정별로 분리해서 저장.
const BOOTSTRAP_CACHE_PREFIX = 'cal2do-bootstrap-cache-';
const bootstrapCacheKey = (uid: string) => BOOTSTRAP_CACHE_PREFIX + uid;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'calendar' | 'list' | 'todo' | 'notes'>('today');
  // 일정탭 전용: 좌우 스와이프가 지금 "월/주 이동"인지 "탭 이동"인지 — 위/아래로 스와이프할 때마다 토글됨
  const [calSwipeMode, setCalSwipeMode] = useState<'date' | 'tabs'>('date');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteFolders, setNoteFolders] = useState<any[]>([]);
  const [todoFolders, setTodoFolders] = useState<any[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [swipeModeHint, setSwipeModeHint] = useState<string | null>(null); // 일정탭 스와이프 모드 전환 안내(화면 중앙, 토스트보다 큼)
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isEmailBackupOpen, setIsEmailBackupOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isAnniversaryOpen, setIsAnniversaryOpen] = useState(false);
  const [isTodoLinkPrefOpen, setIsTodoLinkPrefOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // 메뉴가 열린 시각 — 연 직후(터치/클릭 이벤트가 겹쳐 들어오는 기기에서) 배경(backdrop)이
  // 곧바로 자기 자신을 다시 닫아버려서 정작 누르려던 메뉴 항목의 클릭이 씹히는 문제를 막기 위한 용도.
  const menuOpenedAtRef = useRef(0);
  const [search, setSearch] = useState('');
  const [searchDate, setSearchDate] = useState(''); // 날짜검색 시작일(기간검색의 시작, 하루만 고르면 이 값만 채워짐)
  const [searchDateEnd, setSearchDateEnd] = useState(''); // 날짜검색 종료일(선택)
  const [dateSearchOpen, setDateSearchOpen] = useState(false); // 날짜검색 팝오버(시작/종료일 입력) 열림 여부
  const dateSearchOpenedAtRef = useRef(0); // 메인메뉴와 동일한 이유로, 연 직후 배경 클릭으로 곧바로 닫히는 것을 방지
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [editingNoteFocus, setEditingNoteFocus] = useState<{ focus: 'title' | 'content'; lineIndex?: number; charOffset?: number } | null>(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeModeHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const hscrollElRef = useRef<HTMLElement | null>(null);
  const vscrollElRef = useRef<HTMLElement | null>(null);
  const noTabCycleRef = useRef<boolean>(false);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // 일정탭 스와이프 모드가 바뀔 때 화면 중앙에 크게 잠깐 보여주는 안내(하단 토스트보다 눈에 잘 띄게)
  const showSwipeModeHint = useCallback((message: string) => {
    if (swipeModeHintTimer.current) clearTimeout(swipeModeHintTimer.current);
    setSwipeModeHint(message);
    swipeModeHintTimer.current = setTimeout(() => setSwipeModeHint(null), 1200);
  }, []);

  const applyBootstrapResult = useCallback((res: any) => {
    setEvents(res.events.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end), endDate: e.endDate ? new Date(e.endDate) : null, updatedAt: new Date(e.updatedAt) })));
    setTodos(res.todos.map((t: any) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null, completedAt: t.completedAt ? new Date(t.completedAt) : null, createdAt: new Date(t.createdAt) })));
    setNotes(res.notes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt), deletedAt: n.deletedAt ? new Date(n.deletedAt) : null })));
    setNoteFolders(res.noteFolders || []);
    setTodoFolders(res.todoFolders || []);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    // 로그인된 사용자면, 서버 응답을 기다리기 전에 지난번 캐시부터 먼저 화면에 반영해
    // 로딩 스피너 다음 화면이 곧바로 (약간 오래됐을 수 있는) 데이터로 채워져 보이게 한다.
    if (currentUser) {
      try {
        const cached = localStorage.getItem(bootstrapCacheKey(currentUser.uid));
        if (cached) applyBootstrapResult(JSON.parse(cached));
      } catch (err) { console.error('캐시 데이터 불러오기 실패:', err); }
    }
    setUser(currentUser);
    setLoading(false);
  }), [applyBootstrapResult]);

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

  // 뒤로가기를 눌렀을 때 곧바로 앱이 꺼지지 않도록, 앱을 시작할 때 딱 한 번만 히스토리에
  // 여분 항목을 하나 쌓아둔다. 재시도/재무장/확인창 같은 추가 로직은 전혀 없음 - 그런 걸
  // 넣을수록 다른 모달들의 뒤로가기 처리(useModalBackClose)와 얽혀서 예상 못한 순간에
  // 화면이 초기화되는 문제가 반복됐기 때문에, 이번엔 최대한 단순하게 이것만 한다.
  // (그래서 실수로 뒤로가기 한 번 누른 건 막아주지만, 연달아 여러 번 누르면 결국 종료된다.)
  useEffect(() => {
    window.history.pushState(null, '');
  }, []);


  const refreshData = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const res = await api.bootstrap();
      applyBootstrapResult(res);
      // 다음 실행 때 즉시 보여줄 수 있도록 원본(문자열 날짜 그대로) 응답을 캐시해둠.
      try { localStorage.setItem(bootstrapCacheKey(auth.currentUser.uid), JSON.stringify(res)); }
      catch (err) { console.error('캐시 저장 실패(용량 초과 등, 무시하고 계속):', err); }
    } catch (err) { console.error('데이터 조회 실패:', err); }
  }, [applyBootstrapResult]);

  // 낙관적 로컬 업데이트: 서버 응답을 기다리지 않고 화면에 즉시 반영해 체감 반응속도를 높임
  const patchTodoLocal = useCallback((id: string, patch: any) => setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);
  const removeTodoLocal = useCallback((id: string) => setTodos((prev) => prev.filter((t) => t.id !== id)), []);
  const patchNoteLocal = useCallback((id: string, patch: any) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n))), []);
  // 새로 만드는 항목은 서버 응답(진짜 id)이 오기 전까지 임시 id로 화면에 바로 보이게 하고,
  // 응답이 오면 진짜 id로 바꿔치기(reconcile)한다. 실패하면 그 임시 항목을 다시 지운다.
  // 저장 버튼을 누르자마자 목록에 바로 나타나야 "저장이 느리다"는 느낌이 없어짐.
  const addTodoLocal = useCallback((todo: any) => setTodos((prev) => [todo, ...prev]), []);
  const reconcileTodoLocal = useCallback((tempId: string, realId: string) => setTodos((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t))), []);
  const rollbackTodoLocal = useCallback((id: string) => setTodos((prev) => prev.filter((t) => t.id !== id)), []);
  const addNoteLocal = useCallback((note: any) => setNotes((prev) => [note, ...prev]), []);
  const reconcileNoteLocal = useCallback((tempId: string, realId: string) => setNotes((prev) => prev.map((n) => (n.id === tempId ? { ...n, id: realId } : n))), []);
  // 위 addNoteLocal로 낙관적으로 추가했다가 서버 저장이 실패했을 때만 쓰는 되돌리기용(휴지통 이동과는 다름)
  const rollbackNoteLocal = useCallback((id: string) => setNotes((prev) => prev.filter((n) => n.id !== id)), []);
  const addEventLocal = useCallback((event: any) => setEvents((prev) => [event, ...prev]), []);
  const patchEventLocal = useCallback((id: string, patch: any) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))), []);
  const removeEventLocal = useCallback((id: string) => setEvents((prev) => prev.filter((e) => e.id !== id)), []);
  const reconcileEventLocal = useCallback((tempId: string, realId: string) => setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: realId } : e))), []);
  // 날짜가 바뀐 뒤 처음 앱을 열었을 때, 날짜가 지정된 할일들의 색깔원을 "새 할일 만들 때와 동일한 규칙"으로
  // 다시 계산해줌(예: 어제는 여유였던 할일이 오늘 보니 5일 이내로 다가와서 급함으로 바뀌는 식).
  // 하루에 한 번만 하면 되므로 localStorage에 마지막으로 계산한 날짜를 남겨서 그 이후엔 건너뜀.
  useEffect(() => {
    if (!user || todos.length === 0) return;
    const todayStr = new Date().toDateString();
    let lastStr: string | null = null;
    try { lastStr = window.localStorage.getItem('cal2do-last-color-refresh'); } catch { /* 무시 */ }
    if (lastStr === todayStr) return;
    todos.forEach((t: any) => {
      if (t.completed || !t.dueDate) return;
      const newPriority = autoPriorityForDueDate(t.dueDate.toISOString());
      if (newPriority && newPriority !== t.priority) {
        patchTodoLocal(t.id, { priority: newPriority });
        api.todos.update(t.id, { priority: newPriority }).catch(() => { /* 실패해도 다음 백그라운드 재조회 때 다시 맞춰짐 */ });
      }
    });
    try { window.localStorage.setItem('cal2do-last-color-refresh', todayStr); } catch { /* 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, user]);

  // 백그라운드 자동 재조회: 다른 기기에서 바뀐 내용을 뒤늦게라도 반영하기 위한 용도라
  // 화면이 꺼져있거나(백그라운드 탭) 사용자가 뭔가 입력/수정 중일 때까지 굳이 자주 돌릴 필요는 없음.
  // 매번 이벤트/할일/메모(내용 포함) 전체를 다시 가져오는 무거운 호출이라, 주기를 늘리고
  // 화면이 보이지 않을 땐 건너뛰어서 불필요한 트래픽과 그로 인한 버벅임을 줄인다.
  useEffect(() => {
    if (!user) return;
    refreshData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refreshData();
    }, 120000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') refreshData(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [user, refreshData]);
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);
  // 일정탭을 벗어나면 스와이프 모드를 항상 기본값(월/주 이동)으로 되돌려서, 다음에 들어왔을 때 헷갈리지 않게 함
  useEffect(() => {
    if (view !== 'calendar') setCalSwipeMode('date');
  }, [view]);

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

  // 탭을 바꿀 때 이전 탭에서의 스크롤 위치가 남아있으면, 새 탭(특히 캘린더)의 "화면에 맞춰 높이 계산"
  // 로직이 잘못된 위치를 기준으로 계산해버려 레이아웃이 어긋나는 문제가 있었음 — 탭 전환 시 항상 맨 위로.
  const go = (next: typeof view) => { setView(next); setMenuOpen(false); window.scrollTo(0, 0); };
  // 메인메뉴 항목을 눌러 모달을 열 때, "메뉴 닫기"와 "모달 열기"가 같은 클릭에서 동시에 일어나면
  // 메뉴 자신의 뒤로가기 정리 로직(useModalBackClose)이 자기 히스토리 항목을 못 지우고 남겨버리는
  //문제가 있었음(메인메뉴에서 창을 열었다가 닫은 뒤 화면이 예상 못하게 초기화되던 원인으로 추정).
  // 메뉴를 먼저 완전히 닫고(그 정리가 끝난 뒤) 다음 틱에 모달을 열어서 이 둘이 겹치지 않게 함.
  const openFromMenu = (openFn: () => void) => {
    setMenuOpen(false);
    setTimeout(openFn, 0);
  };
  // 목록 탭은 메인메뉴로 이동했으므로 탭바/스와이프 순환에서는 제외 (view 상태 자체는 유지)
  // 일정탭은 맨 뒤(메모탭 다음)로 옮김 — 월별보기에서 위아래로 살짝만 움직여도 탭이 훌쩍 넘어가버리는 문제 때문에,
  // 일정탭 안에서는 위아래 스와이프로 탭을 바로 넘기지 않고 "좌우 스와이프의 의미(월/주 이동 ↔ 탭 이동)"만 토글하도록 바꿈
  const tabs: Array<[typeof view, string]> = [['today', '오늘'], ['todo', '할일'], ['notes', '메모'], ['calendar', '일정']];
  const activeNotes = notes.filter((n: any) => !n.deletedAt);
  // 수정할 때마다(체크박스 토글 등으로 updatedAt이 바뀔 때마다) 카드 위치가 요동치지 않도록,
  // 오늘 탭에서는 항상 생성순으로 고정 정렬한다 (activeNotes는 updatedAt 내림차순이라 그대로 쓰면 안 됨).
  const todayNotes = [...activeNotes].filter((n: any) => n.showToday).sort((a: any, b: any) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  const anyOverlayOpen = menuOpen || dateSearchOpen || isImportExportOpen || isEmailBackupOpen || isDataManagementOpen || isVersionOpen || isHelpOpen || !!editingTodo || !!editingNote || isNewNoteOpen || !!search.trim() || !!searchDate;

  const MIN_SWIPE_PX = 60; // 손가락이 살짝 삐끗한 정도(탭 중 미세한 흔들림)까지 스와이프로 오인하지 않도록 최소 이동거리
  // 탭 순서상 direction만큼 옮기고, 새 탭 진입 시 레이아웃이 어긋나지 않도록 항상 맨 위로 스크롤
  const cycleTab = (direction: 1 | -1) => {
    const idx = tabs.findIndex(([key]) => key === view);
    if (idx === -1) return;
    const nextIdx = (idx + direction + tabs.length) % tabs.length;
    setView(tabs[nextIdx][0]);
    window.scrollTo(0, 0);
  };
  // 세로 스크롤 가능한 영역(주별보기 시간표 등, data-vscroll)이 있으면 그 영역이 이미 스와이프 방향 끝(맨 위/맨 아래)에
  // 닿아있을 때만 true. 명시적인 스크롤 영역을 못 찾았으면(월별보기처럼 화면 안에 다 들어오는 경우) 페이지 자체의
  // 스크롤 위치로 판단 — 어차피 스크롤할 게 없으면 위/아래 어느 쪽으로도 항상 "끝"이라 바로 탭 전환이 허용됨.
  const isVerticalScrollAtEdge = (vgrid: HTMLElement | null, deltaY: number) => {
    const el: { scrollTop: number; clientHeight: number; scrollHeight: number } =
      vgrid || (document.scrollingElement as HTMLElement) || document.documentElement;
    const atBottomEdge = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const atTopEdge = el.scrollTop <= 1;
    return deltaY < 0 ? atBottomEdge : atTopEdge;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    // 일정표(월/주별보기) 영역 안이면 해당 스크롤 요소를 기억해뒀다가, 끝에 도달한 상태에서
    // 그 방향으로 더 밀었을 때만 탭 순환으로 이어지도록 함(가로: 다른 탭, 세로: 일정탭 전용)
    hscrollElRef.current = (e.target as HTMLElement).closest('[data-hscroll]') as HTMLElement | null;
    vscrollElRef.current = (e.target as HTMLElement).closest('[data-vscroll]') as HTMLElement | null;
    // 일정탭 "넓게보기" 상태에서는 끝까지 밀어도 탭 순환(가로/세로 모두)으로 이어지면 안 되므로 아예 별도로 표시
    noTabCycleRef.current = !!(e.target as HTMLElement).closest('[data-no-tab-cycle]');
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    // 입력창/수정창 등 모달이 하나라도 열려있으면(useModalBackClose로 추적) 그 안에서의 스크롤이
    // 탭 순환으로 이어지지 않도록 함 — 이전에는 개별 상태(anyOverlayOpen)만 확인해서 놓치는 모달이 있었음
    if (touchStartX.current === null || touchStartY.current === null || anyOverlayOpen || isAnyModalOpen()) {
      touchStartX.current = null; touchStartY.current = null; noTabCycleRef.current = false; hscrollElRef.current = null; vscrollElRef.current = null;
      return;
    }
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    const blockedByNoTabCycle = noTabCycleRef.current;
    noTabCycleRef.current = false;
    const grid = hscrollElRef.current;
    hscrollElRef.current = null;
    const vgrid = vscrollElRef.current;
    vscrollElRef.current = null;
    if (blockedByNoTabCycle) return;

    // 위/아래로 크게 움직인 쪽이 뚜렷할 때만(1.5배 이상) 세로 스와이프로 인정, 반대도 마찬가지
    const isHorizontalDominant = Math.abs(deltaX) >= Math.abs(deltaY) * 1.5;
    const isVerticalDominant = Math.abs(deltaY) >= Math.abs(deltaX) * 1.5;

    if (view === 'calendar') {
      // 일정탭: 세로 스와이프는 "좌우 스와이프가 지금 뭘 하는지"를 토글하고,
      // 가로 스와이프는 그 순간의 모드에 따라 월/주 이동(date) 또는 탭 이동(tabs)으로 동작함.
      // 월별보기는 화면 안에 다 들어오게 만들어서 스크롤할 여지가 거의 없다 보니, 예전처럼 세로 스와이프로
      // 곧장 다른 탭(오늘/할일/메모)까지 넘겨버리면 살짝만 움직여도 화면이 훌쩍 바뀌는 문제가 있었음.
      // "모드만 바꾸는" 정도로 낮춰서, 실수로 건드려도 다시 위아래로 한 번 더 밀면 바로 원래대로 돌아옴.
      if (isVerticalDominant) {
        if (Math.abs(deltaY) < MIN_SWIPE_PX) return;
        if (!isVerticalScrollAtEdge(vgrid, deltaY)) return; // 시간표가 아직 스크롤할 여지가 있으면 그 스크롤만
        const nextMode = calSwipeMode === 'date' ? 'tabs' : 'date';
        setCalSwipeMode(nextMode);
        showSwipeModeHint(nextMode === 'tabs' ? '좌우로 밀면 탭간 이동' : '좌우로 밀면 월(주) 이동');
        return;
      }
      if (isHorizontalDominant) {
        if (calSwipeMode !== 'tabs') return; // date 모드에서는 Calendar 컴포넌트가 자체적으로 월/주를 이동시킴
        if (Math.abs(deltaX) < MIN_SWIPE_PX) return;
        cycleTab(deltaX < 0 ? 1 : -1);
      }
      return;
    }

    // 그 외 탭(오늘/할일/메모): 기존처럼 가로 스와이프만 탭 전환
    if (!isHorizontalDominant) return;
    if (grid) {
      // 왼쪽으로 밀 때(다음 탭 방향)는 그리드가 이미 오른쪽 끝까지 스크롤된 상태여야 하고,
      // 오른쪽으로 밀 때(이전 탭 방향)는 이미 왼쪽 끝(scrollLeft 0)이어야 함
      const atRightEdge = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 1;
      const atLeftEdge = grid.scrollLeft <= 1;
      const atRelevantEdge = deltaX < 0 ? atRightEdge : atLeftEdge;
      if (!atRelevantEdge) return; // 아직 스크롤할 여지가 있으면 탭 순환은 무시하고 그리드 스크롤만
    }
    if (Math.abs(deltaX) < MIN_SWIPE_PX) return;
    // 왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭
    cycleTab(deltaX < 0 ? 1 : -1);
  };

  return <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { const opening = !menuOpen; if (opening) menuOpenedAtRef.current = Date.now(); setMenuOpen(opening); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0" aria-label="메뉴"><Menu className="w-5 h-5" /></button>
          <div className="font-black tracking-tight mr-1 hidden sm:block">Cal2do</div>
          <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 no-scrollbar">{tabs.map(([key, label]) => <button key={key} onClick={() => go(key)} className={`px-2.5 py-1.5 rounded-lg text-base font-semibold whitespace-nowrap ${view === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{label}</button>)}</nav>
        </div>
        <div className="relative w-full sm:w-48 md:w-64 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400"/>
            <input value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) { setSearchDate(''); setSearchDateEnd(''); } }} placeholder="검색" className="w-full pl-8 pr-[4.7rem] py-2 rounded-lg bg-slate-100 dark:bg-slate-800 outline-none text-sm" />
            <button
              type="button"
              onClick={() => { const opening = !dateSearchOpen; if (opening) dateSearchOpenedAtRef.current = Date.now(); setDateSearchOpen(opening); }}
              title="날짜(기간)로 전체 기록 보기"
              className={`absolute right-1 top-1 bottom-1 px-1.5 rounded-md transition flex items-center gap-1 ${searchDate ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <span className="text-[10px] font-bold whitespace-nowrap">날짜검색</span>
              <CalendarSearch className="w-4 h-4 shrink-0" />
            </button>
          </div>
          {dateSearchOpen && <>
            <ModalBackCloseGuard onClose={() => setDateSearchOpen(false)} />
            <div className="fixed inset-0 z-[75]" onClick={() => { if (Date.now() - dateSearchOpenedAtRef.current < 250) return; setDateSearchOpen(false); }} />
            <div className="absolute right-0 top-full mt-1.5 z-[80] w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">날짜(기간)로 전체 기록 보기</div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">시작</label>
                <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">종료</label>
                {/* 종료일은 선택 사항 — 비워두면 시작일 하루만 검색(기존과 동일) */}
                <input type="date" value={searchDateEnd} min={searchDate || undefined} onChange={(e) => setSearchDateEnd(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => { setSearchDate(''); setSearchDateEnd(''); }} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">초기화</button>
                <button type="button" disabled={!searchDate} onClick={() => { setSearch(''); setDateSearchOpen(false); }} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">검색</button>
              </div>
            </div>
          </>}
          {(search.trim() || searchDate) && (
            <GlobalSearch
              query={search}
              date={searchDate ? new Date(searchDate) : null}
              dateEnd={searchDateEnd ? new Date(searchDateEnd) : null}
              events={events}
              todos={todos}
              notes={activeNotes}
              folders={noteFolders}
              onClose={() => { setSearch(''); setSearchDate(''); setSearchDateEnd(''); }}
              onEvent={() => { setSearch(''); setSearchDate(''); setSearchDateEnd(''); setView('list'); }}
              onTodo={(t: any) => { setSearch(''); setSearchDate(''); setSearchDateEnd(''); setEditingTodo(t); }}
              onNote={(n: any) => { setSearch(''); setSearchDate(''); setSearchDateEnd(''); setEditingNote(n); }}
              onRefresh={refreshData}
              onNotify={notify}
            />
          )}
        </div>
      </div>
    </header>
    {menuOpen && <>
      <ModalBackCloseGuard onClose={() => setMenuOpen(false)} />
      {/* 헤더(z-40)보다는 위, 메뉴 박스(z-50)보다는 아래로 확실히 분리 — 예전엔 헤더와 같은 z-40이라
          쌓임 순서가 DOM 순서에 의존했었음(뒤에 그려진 게 우선인데, 우연히 헤더 위로 올라올 수 있었음).
          여는 순간(터치+마우스 합성 클릭이 겹치는 기기 등) 곧바로 자기 자신을 닫아버려 정작 누르려던
          항목의 클릭이 씹히는 문제를 막기 위해, 연 지 250ms 안에는 배경 클릭을 무시한다. */}
      <div className="fixed inset-0 z-[45]" onClick={() => { if (Date.now() - menuOpenedAtRef.current < 250) return; setMenuOpen(false); }} />
      <div className="fixed top-14 left-2 z-50 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
        <button onClick={() => openFromMenu(() => setIsImportExportOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">가져오기 / 내보내기</button>
        <button onClick={() => openFromMenu(() => setIsEmailBackupOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">이메일 백업</button>
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button onClick={() => go('list')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">일정 목록 보기</button>
        <button onClick={() => openFromMenu(() => setIsDataManagementOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">일정데이터 관리</button>
        <button onClick={() => openFromMenu(() => setIsAnniversaryOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">기념일 관리</button>
        <button onClick={() => openFromMenu(() => setIsTodoLinkPrefOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">할일-일정 연동 설정</button>
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button onClick={() => { setIsDarkMode(!isDarkMode); setMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{isDarkMode ? '밝은 모드' : '다크 모드'}</button>
        <button onClick={() => openFromMenu(() => setIsHelpOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">도움말</button>
        <button onClick={() => openFromMenu(() => setIsVersionOpen(true))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">버전 정보</button>
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button onClick={() => signOut(auth)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">로그아웃</button>
      </div>
    </>}
    <main className="max-w-7xl mx-auto p-2.5 sm:p-4">{view === 'today' ? <HomeView events={events} todos={todos} notes={todayNotes} todoFolders={todoFolders} noteFolders={noteFolders} user={user} onNotify={notify} onRefresh={refreshData} onPatchTodo={patchTodoLocal} onRemoveTodo={removeTodoLocal} onAddTodo={addTodoLocal} onReconcileTodo={reconcileTodoLocal} onPatchNote={patchNoteLocal} onAddNote={addNoteLocal} onReconcileNote={reconcileNoteLocal} onAddEvent={addEventLocal} onPatchEvent={patchEventLocal} onRemoveEvent={removeEventLocal} onReconcileEvent={reconcileEventLocal} onNewNote={() => setIsNewNoteOpen(true)} onEditNote={(n: any, focus?: 'title' | 'content', lineIndex?: number, charOffset?: number) => { setEditingNote(n); setEditingNoteFocus({ focus: focus || 'content', lineIndex, charOffset }); }} /> : view === 'calendar' ? <Calendar key="calendar-view" events={events} user={user} onRefresh={refreshData} onNotify={notify} onAddEvent={addEventLocal} onPatchEvent={patchEventLocal} onRemoveEvent={removeEventLocal} onReconcileEvent={reconcileEventLocal} swipeMode={calSwipeMode} /> : view === 'list' ? <EventListView events={events} user={user} onRefresh={refreshData} onNotify={notify} /> : view === 'todo' ? <TodoView todos={todos} folders={todoFolders} user={user} onNotify={notify} onRefresh={refreshData} onPatchTodo={patchTodoLocal} onRemoveTodo={removeTodoLocal} onAddTodo={addTodoLocal} onReconcileTodo={reconcileTodoLocal} onSwipeHint={showSwipeModeHint} /> : <NotesView notes={notes} folders={noteFolders} user={user} onNotify={notify} onRefresh={refreshData} onNewNote={() => setIsNewNoteOpen(true)} onEditNote={(n: any, focus?: 'title' | 'content', lineIndex?: number, charOffset?: number) => { setEditingNote(n); setEditingNoteFocus({ focus: focus || 'title', lineIndex, charOffset }); }} onPatchNote={patchNoteLocal} onAddNote={addNoteLocal} onReconcileNote={reconcileNoteLocal} onSwipeHint={showSwipeModeHint} />}</main>
    {isImportExportOpen && <ImportExportPanel user={user} events={events} todos={todos} notes={activeNotes} folders={noteFolders} todoFolders={todoFolders} onClose={() => setIsImportExportOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {isEmailBackupOpen && <EmailBackupPanel user={user} onClose={() => setIsEmailBackupOpen(false)} onNotify={notify} />}
    {isDataManagementOpen && <DataManagementPanel events={events} user={user} onClose={() => setIsDataManagementOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {isAnniversaryOpen && <AnniversaryModal events={events} user={user} onClose={() => setIsAnniversaryOpen(false)} onRefresh={refreshData} onNotify={notify} />}
    {isTodoLinkPrefOpen && <TodoEventLinkSettingsModal onClose={() => setIsTodoLinkPrefOpen(false)} />}
    {isVersionOpen && <VersionModal onClose={() => setIsVersionOpen(false)} />}
    {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
    {editingTodo && <TodoModal todo={editingTodo} folders={todoFolders} notify={notify} onClose={() => setEditingTodo(null)} onRefresh={refreshData} />}
    {(editingNote || isNewNoteOpen) && <NoteModal note={editingNote} folders={noteFolders} secureFolderId={noteFolders.find((f: any) => f.isSecure)?.id || null} initialFocus={editingNoteFocus?.focus} initialLineIndex={editingNoteFocus?.lineIndex} initialCharOffset={editingNoteFocus?.charOffset} onClose={() => { setEditingNote(null); setIsNewNoteOpen(false); setEditingNoteFocus(null); }} onRefresh={refreshData} onNotify={notify} onAddLocal={addNoteLocal} onPatchLocal={patchNoteLocal} onReconcileLocal={reconcileNoteLocal} onRollbackLocal={rollbackNoteLocal} />}
    {toast && <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-sm font-bold ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>{toast.message}</div>}
    {swipeModeHint && <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6"><div className="bg-slate-900/70 dark:bg-slate-800/70 text-white text-base sm:text-lg font-medium px-5 py-3 rounded-2xl shadow-2xl text-center animate-in fade-in zoom-in duration-150">{swipeModeHint}</div></div>}
  </div>;
}
