'use client';

import { useEffect, useState } from 'react';

const MAX_ENTRIES = 30;

/**
 * 특정 입력창(namespace)에서 예전에 입력했던 값들을 기기(localStorage)에 기억해뒀다가,
 * 구글 검색창처럼 다시 입력할 때 아래에 후보로 보여주기 위한 훅.
 * 서버로 전송되지 않는 순수 로컬 기록이라 별도 API/DB 변경 없이 동작함.
 */
export function useRecentInputs(namespace: string) {
  const storageKey = `cal2do:recent:${namespace}`;
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remember = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setItems((prev) => {
      const next = [v, ...prev.filter((x) => x !== v)].slice(0, MAX_ENTRIES);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const suggestionsFor = (query: string, limit = 5) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((v) => v.toLowerCase().includes(q) && v.toLowerCase() !== q).slice(0, limit);
  };

  return { items, remember, suggestionsFor };
}
