'use client';

import { useState, useEffect } from 'react';
import { db, auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import Calendar from '../components/ui/calendar';
import TodoView from '../components/calendar/TodoView';
import { LogOut, LogIn, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'todo'>('month');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">로딩 중...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-5xl font-black mb-4 text-white tracking-tighter">CalTodo</h1>
        <p className="text-slate-400 mb-10 max-w-xs">갤럭시 폴드에서도, PC에서도 안전하게 동기화되는 나만의 캘린더</p>
        <button 
          onClick={() => signInWithPopup(auth, googleProvider)}
          className="flex items-center gap-4 bg-white text-black px-10 py-5 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all active:scale-95"
        >
          <LogIn className="w-6 h-6" /> 구글로 시작하기
        </button>
      </div>
    );
  }

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
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border-2 border-blue-500 shadow-lg" />
          <button onClick={() => signOut(auth)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>
      <div className="p-4 max-w-7xl mx-auto">
        {view === 'todo' ? <TodoView todos={todos} user={user} /> : <Calendar view={view} events={events} user={user} />}
      </div>
    </main>
  );
}