'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import Calendar from '../components/ui/calendar';
import TodoView from '../components/calendar/TodoView';
import { LogOut, LogIn, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // 로딩 상태 중요
  const [view, setView] = useState<'month' | 'week' | 'todo'>('month');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // 1. 페이지 로드 시 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // 상태 파악 완료 후 로딩 해제
    });
    return () => unsubscribe();
  }, []);

  // 2. 데이터 실시간 구독 (이전과 동일)
  useEffect(() => {
    if (!user) return;
    const qEvents = query(collection(db, "events"), where("userId", "==", user.uid));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: doc.data().start?.toDate() || new Date(),
        end: doc.data().end?.toDate() || new Date(),
      })));
    });
    const qTodos = query(collection(db, "todos"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeTodos = onSnapshot(qTodos, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate() || null,
      })));
    });
    return () => { unsubscribeEvents(); unsubscribeTodos(); };
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // 성공 시 onAuthStateChanged가 자동으로 user를 세팅함
    } catch (error: any) {
      // 사용자가 팝업을 닫은 경우는 에러로 표시하지 않음
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error("로그인 시도 에러:", error);
      setAuthError(`${error.code || 'unknown'}: ${error.message || error}`);
    }
  };

  // 로딩 중일 때 화면 (번쩍임을 방지)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-slate-400">안전하게 연결 중입니다...</p>
      </div>
    );
  }

  // 로그인 전 화면
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-5xl font-black mb-4 text-white tracking-tighter italic">CalTodo</h1>
        <p className="text-slate-400 mb-10 max-w-xs">기기를 접거나 꺼도 데이터가 안전하게 보관됩니다.</p>
        <button 
          onClick={handleLogin}
          className="flex items-center gap-4 bg-white text-black px-10 py-5 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all"
        >
          <LogIn className="w-6 h-6" /> 구글로 시작하기
        </button>
        {authError && (
          <p className="mt-6 max-w-xs text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 break-words">
            로그인 실패: {authError}
          </p>
        )}
      </div>
    );
  }

  // 로그인 후 메인 화면
  return (
    <main className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className="border-b p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md border-slate-700 bg-[#0f172a]/80">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">CalTodo</h1>
          <nav className="flex bg-slate-800 rounded-lg p-1">
            {['month', 'week', 'todo'].map((v: any) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-md text-sm font-bold ${view === v ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                {v === 'month' ? '월' : v === 'week' ? '주' : '할일'}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-slate-800 rounded-full">
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-400" />}
          </button>
          <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border-2 border-blue-500 shadow-lg" alt="profile" />
          <button onClick={() => signOut(auth)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>
      <div className="p-4 max-w-7xl mx-auto">
        {view === 'todo' ? <TodoView todos={todos} user={user} onNotify={notify} /> : <Calendar view={view} events={events} user={user} onNotify={notify} />}
      </div>
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-2xl text-sm font-bold text-white transition-all
            ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}