import { auth } from './firebase';
import { withTimeout } from './withTimeout';

type QueuedMutation = {
  id: string;
  path: string;
  method: string;
  body: string | null;
  queuedAt: number;
};

const QUEUE_PREFIX = 'cal2do-offline-queue-';
let syncRunning = false;

const queueKey = (uid: string) => QUEUE_PREFIX + uid;

function readQueue(uid: string): QueuedMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(queueKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(uid: string, queue: QueuedMutation[]) {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) window.localStorage.removeItem(queueKey(uid));
    else window.localStorage.setItem(queueKey(uid), JSON.stringify(queue));
  } catch (err) {
    console.error('[offline] 큐 저장 실패:', err);
  }
}

function isQueueableMutation(path: string, method: string) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return false;
  return path.startsWith('/api/todos') || path.startsWith('/api/notes') || path.startsWith('/api/events');
}

function dispatchSyncComplete() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cal2do-offline-sync-complete'));
  }
}

function enqueueMutation(uid: string, path: string, method: string, body: string | null) {
  const queue = readQueue(uid);
  const mutation: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    path,
    method: method.toUpperCase(),
    body,
    queuedAt: Date.now(),
  };

  // 같은 항목에 대한 연속적인 수정은 마지막 상태만 남긴다.
  // POST(생성)와 DELETE는 순서를 보존해야 하므로 합치지 않는다.
  if (mutation.method === 'PUT' || mutation.method === 'PATCH') {
    const samePathIndex = [...queue].reverse().findIndex((q) => q.path === path && q.method === mutation.method);
    if (samePathIndex >= 0) {
      const index = queue.length - 1 - samePathIndex;
      queue[index] = mutation;
      writeQueue(uid, queue);
      return;
    }
  }

  queue.push(mutation);
  writeQueue(uid, queue);
}

async function syncPendingMutations() {
  if (syncRunning || typeof window === 'undefined' || !navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;

  const queue = readQueue(user.uid);
  if (queue.length === 0) return;

  syncRunning = true;
  let changed = false;
  try {
    const headers = await authHeaders();
    const remaining: QueuedMutation[] = [];

    for (const mutation of queue) {
      try {
        const res = await withTimeout(fetch(mutation.path, {
          method: mutation.method,
          headers,
          body: mutation.body || undefined,
        }));

        if (!res.ok) {
          // 인증/권한 오류나 서버 검증 오류는 무한 재시도하지 않는다.
          // 네트워크 오류만 다음 연결 때 다시 시도한다.
          if (res.status >= 400 && res.status < 500) {
            console.error('[offline] 동기화 거부:', mutation.path, res.status);
            changed = true;
            continue;
          }
          remaining.push(mutation);
          continue;
        }

        changed = true;
      } catch (err: any) {
        // 타임아웃은 서버가 이미 처리했을 가능성이 있으므로 재전송하지 않는다.
        // 순수 네트워크 오류만 큐에 남겨 다음 연결 때 다시 시도한다.
        if (err?.isTimeout) {
          console.error('[offline] 동기화 타임아웃 — 중복 방지를 위해 큐에서 제외:', mutation.path);
          changed = true;
          continue;
        }
        remaining.push(mutation);
      }

      if (!navigator.onLine) {
        remaining.push(...queue.slice(queue.indexOf(mutation) + 1));
        break;
      }
    }

    writeQueue(user.uid, remaining);
    if (changed) dispatchSyncComplete();
  } catch (err) {
    console.error('[offline] 동기화 준비 실패:', err);
  } finally {
    syncRunning = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void syncPendingMutations(); });
  // 앱을 다시 열었을 때 이미 온라인이면 남아 있던 큐를 백그라운드에서 비운다.
  setTimeout(() => { void syncPendingMutations(); }, 1000);
}

async function authHeaders() {
  if (!auth.currentUser) {
    try { await auth.authStateReady(); } catch { /* ignore */ }
  }
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    await new Promise((r) => setTimeout(r, 700));
    token = await user.getIdToken();
  }
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request(path: string, options: RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
  const body = typeof options.body === 'string' ? options.body : null;
  const user = auth.currentUser;

  // 앱 시작/새로고침 때 서버 스냅샷을 가져오기 전에 대기 중인 로컬 변경부터 밀어 넣는다.
  // 그래야 오프라인에서 수정한 값이 서버의 오래된 값으로 잠깐 덮어써지는 일이 없다.
  if (user && method === 'GET' && typeof window !== 'undefined' && navigator.onLine) {
    await syncPendingMutations();
  }

  // 목록 조회는 서버가 기준이다. 쓰기 작업만 오프라인 큐에 보존한다.
  if (user && isQueueableMutation(path, method) && typeof window !== 'undefined' && !navigator.onLine) {
    enqueueMutation(user.uid, path, method, body);
    return { queued: true };
  }

  const doFetch = () => withTimeout(fetch(path, { ...options, headers }));

  let res: Response;
  try {
    res = await doFetch();
  } catch (err: any) {
    if (err?.isTimeout) throw err;

    // 요청 자체가 네트워크에 도달하지 못한 경우에는 로컬 큐에 넣고 성공으로 반환한다.
    // 화면 상태는 이미 호출부에서 즉시 반영하고 있으므로, 여기서는 "서버 저장 대기 중" 상태만 남긴다.
    if (user && isQueueableMutation(path, method)) {
      enqueueMutation(user.uid, path, method, body);
      return { queued: true };
    }

    await new Promise((r) => setTimeout(r, 700));
    try {
      res = await doFetch();
    } catch (err2: any) {
      if (err2?.isTimeout) throw err2;
      const netErr: any = new Error('네트워크 연결이 불안정합니다. 다시 시도해주세요.');
      netErr.isNetworkError = true;
      throw netErr;
    }
  }

  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {}
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  // 정상 요청이 끝났으면 남아 있는 오프라인 큐도 조용히 비운다.
  if (user && typeof window !== 'undefined') void syncPendingMutations();
  return res.json();
}

export const api = {
  bootstrap: () => request('/api/bootstrap'),
  events: {
    list: () => request('/api/events'),
    create: (data: any) => request('/api/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/api/events/${id}`, { method: 'DELETE' }),
    manage: (data: any) => request('/api/events/manage', { method: 'POST', body: JSON.stringify(data) }),
  },
  todos: {
    list: () => request('/api/todos'),
    create: (data: any) => request('/api/todos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/api/todos/${id}`, { method: 'DELETE' }),
  },
  notes: {
    list: (includeDeleted = false) => request(`/api/notes${includeDeleted ? '?includeDeleted=true' : ''}`),
    create: (data: any) => request('/api/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/api/notes/${id}`, { method: 'DELETE' }),
    restore: (id: string) => request(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'restore' }) }),
    purge: (id: string) => request(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'purge' }) }),
  },
  noteFolders: {
    list: () => request('/api/note-folders'),
    create: (name: string, color?: string | null) => request('/api/note-folders', { method: 'POST', body: JSON.stringify({ name, color }) }),
    rename: (id: string, name: string, color?: string | null) => request(`/api/note-folders/${id}`, { method: 'PUT', body: JSON.stringify({ name, color }) }),
    remove: (id: string) => request(`/api/note-folders/${id}`, { method: 'DELETE' }),
    setupSecure: (id: string, lockType: string, code: string) => request(`/api/note-folders/${id}/secure`, { method: 'POST', body: JSON.stringify({ lockType, code }) }),
    verifySecure: (id: string, code: string) => request(`/api/note-folders/${id}/secure`, { method: 'PUT', body: JSON.stringify({ code }) }),
    unsecure: (id: string, code: string) => request(`/api/note-folders/${id}/secure`, { method: 'DELETE', body: JSON.stringify({ code }) }),
    requestSecureReset: (id: string) => request(`/api/note-folders/${id}/secure/reset`, { method: 'POST' }),
    confirmSecureReset: (id: string, code: string, newLockType: string, newCode: string) => request(`/api/note-folders/${id}/secure/reset`, { method: 'PUT', body: JSON.stringify({ code, newLockType, newCode }) }),
  },
  todoFolders: {
    list: () => request('/api/todo-folders'),
    create: (name: string, color?: string | null) => request('/api/todo-folders', { method: 'POST', body: JSON.stringify({ name, color }) }),
    rename: (id: string, name: string, color?: string | null) => request(`/api/todo-folders/${id}`, { method: 'PUT', body: JSON.stringify({ name, color }) }),
    remove: (id: string) => request(`/api/todo-folders/${id}`, { method: 'DELETE' }),
  },
  backup: {
    getSettings: () => request('/api/backup/settings'),
    updateSettings: (frequency: string) => request('/api/backup/settings', { method: 'PUT', body: JSON.stringify({ frequency }) }),
    sendNow: () => request('/api/backup/send', { method: 'POST' }),
  },
};
