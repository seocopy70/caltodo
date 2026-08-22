'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import Calendar from '@/components/ui/Calendar';
import TodoView from '@/components/calendar/TodoView';
import { Calendar as CalendarIcon, CheckSquare, Search, Plus, Bell, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'month' | 'week' | 'todo'>('month');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 실시간 데이터 구독 (Firestore)
  useEffect(() => {
    const qEvents = query(collection(db, "events"));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: (doc.data().start as Timestamp).toDate(),
        end: (doc.data().end as Timestamp).toDate(),
      }));
      setEvents(eventData);
    });

    const qTodos = query(collection(db, "todos"), orderBy("createdAt", "desc"));
    const unsubscribeTodos = onSnapshot(qTodos, (snapshot) => {
      const todoData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate ? (doc.data().dueDate as Timestamp).toDate() : null,
      }));
      setTodos(todoData);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeTodos();
    };
  }, []);

  // 테마 변경
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <main className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* 헤더 */}
      <header className="border-b border-slate-700 p-4 flex items-center justify-between sticky top-0 bg-opacity-80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            CalTodo
          </h1>
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded-md text-sm transition ${view === 'month' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >월</button>
            <button 
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded-md text-sm transition ${view === 'week' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >주</button>
            <button 
              onClick={() => setView('todo')}
              className={`px-3 py-1 rounded-md text-sm transition ${view === 'todo' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >할일</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="검색..."
              className="bg-slate-800 rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-slate-800 rounded-full">
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2 hover:bg-slate-800 rounded-full text-blue-400">
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 컨텐츠 구역 */}
      <div className="p-4">
        {view === 'todo' ? (
          <TodoView todos={todos} db={db} />
        ) : (
          <Calendar view={view} events={events} db={db} />
        )}
      </div>
    </main>
  );
}