'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';

// 질문자님의 실제 폴더 구조와 소문자 파일명 반영
import Calendar from '../components/ui/calendar';
import TodoView from '../components/calendar/TodoView';

import { Search, Plus, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'month' | 'week' | 'todo'>('month');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Firebase 실시간 데이터 구독
  useEffect(() => {
    // 이벤트 실시간 가져오기
    const qEvents = query(collection(db, "events"));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const eventData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Firestore Timestamp를 JS Date 객체로 변환
          start: data.start instanceof Timestamp ? data.start.toDate() : new Date(data.start),
          end: data.end instanceof Timestamp ? data.end.toDate() : new Date(data.end),
        };
      });
      setEvents(eventData);
    });

    // 할일 실시간 가져오기
    const qTodos = query(collection(db, "todos"), orderBy("createdAt", "desc"));
    const unsubscribeTodos = onSnapshot(qTodos, (snapshot) => {
      const todoData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : (data.dueDate ? new Date(data.dueDate) : null),
        };
      });
      setTodos(todoData);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeTodos();
    };
  }, []);

  // 2. 다크모드 적용
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <main className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* 고정 헤더 */}
      <header className={`border-b p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md ${isDarkMode ? 'border-slate-700 bg-[#0f172a]/80' : 'border-gray-200 bg-white/80'}`}>
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            CalTodo
          </h1>
          <div className={`flex rounded-lg p-1 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
            <button 
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded-md text-sm transition ${view === 'month' ? 'bg-blue-600 text-white' : 'hover:opacity-70'}`}
            >월</button>
            <button 
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded-md text-sm transition ${view === 'week' ? 'bg-blue-600 text-white' : 'hover:opacity-70'}`}
            >주</button>
            <button 
              onClick={() => setView('todo')}
              className={`px-3 py-1 rounded-md text-sm transition ${view === 'todo' ? 'bg-blue-600 text-white' : 'hover:opacity-70'}`}
            >할일</button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="검색..."
              className={`rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-900'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-200'}`}>
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2 rounded-full text-blue-500 hover:bg-blue-500/10 transition">
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <div className="p-4 max-w-7xl mx-auto">
        {view === 'todo' ? (
          <TodoView todos={todos} db={db} />
        ) : (
          <Calendar view={view} events={events} db={db} />
        )}
      </div>
    </main>
  );
}