'use client';

import { useEffect, useState } from 'react';

const MAX_ENTRIES = 30;

// 같은 값(대소문자 무시)은 먼저 나온 것만 남기고 순서를 유지한 채 합침.
// 로컬에 최근 입력한 값(더 최신)을 앞에 두고, 그 뒤에 서버 데이터에서 뽑아온 과거 값을 이어붙이는 용도.
function mergeUnique(...lists: string[][]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const v = raw.trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * 특정 입력창(namespace)에서 예전에 입력했던 값들을 후보로 보여주기 위한 훅.
 * 1) 이 기기(localStorage)에 실제로 "저장 버튼을 눌러서" 남긴 최근 입력값(최신순) +
 * 2) 서버에 이미 저장되어 있는 데이터에서 뽑아온 과거 값(extraItems, 예: 기존 일정들의 장소/제목)
 * 두 가지를 합쳐서 후보로 준다 — extraItems가 없으면 기존과 동일하게 동작한다.
 */
export function useRecentInputs(namespace: string, extraItems: string[] = []) {
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
    const merged = mergeUnique(items, extraItems);
    // 아직 아무것도 입력하지 않은 상태(포커스만 준 상태)에서도 후보를 보여줌(구글 검색창처럼)
    if (!q) return merged.slice(0, limit);
    return merged.filter((v) => v.toLowerCase().includes(q) && v.toLowerCase() !== q).slice(0, limit);
  };

  return { items, remember, suggestionsFor };
}
