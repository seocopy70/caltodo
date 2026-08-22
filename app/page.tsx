'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

// 질문자님의 이미지 구조와 정확히 일치시킨 경로
import Calendar from '../components/ui/calendar';      // 소문자 c
import TodoView from '../components/calendar/TodoView'; // 대문자 T, V

import { Search, Plus, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'month' | 'week' | 'todo'>('month');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const qEvents = query(collection(db, "events"));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const eventData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          start: data.start instanceof Timestamp ? data.start.toDate() : new Date(),
          end: data.end instanceof Timestamp ? data.end.toDate() : new Date(),
        };
      });
      setEvents(eventData);
    });

    const qTodos = query(collection(db, "todos"), orderBy("createdAt", "desc"));
    const unsubscribeTodos = onSnapshot(qTodos, (snapshot) => {
      const todoData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : null,
        };
      });
      setTodos(todoData);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeTodos();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <main className={`min-h-screen ${isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`border-b p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md ${isDarkMode ? 'border-slate-700 bg-[#0f172a]/80' : 'border-gray-200 bg-white/80'}`}>
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">CalTodo</h1>
          <div className="flex rounded-lg p-1 bg-slate-800">
            <button onClick={() => setView('month')} className={`px-3 py-1 rounded-md text-sm ${view === 'month' ? 'bg-blue-600' : ''}`}>월</button>
            <button onClick={() => setView('week')} className={`px-3 py-1 rounded-md text-sm ${view === 'week' ? 'bg-blue-600' : ''}`}>주</button>
            <button onClick={() => setView('todo')} className={`px-3 py-1 rounded-md text-sm ${view === 'todo' ? 'bg-blue-600' : ''}`}>할일</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-slate-800 rounded-full">
            {isDarkMode ? <Sun className="text-yellow-400" /> : <Moon />}
          </button>
        </div>
      </header>
      <div className="p-4">
        {view === 'todo' ? <TodoView todos={todos} db={db} /> : <Calendar view={view} events={events} db={db} />}
      </div>
    </main>
  );
}