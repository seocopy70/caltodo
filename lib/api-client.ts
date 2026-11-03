import { auth } from './firebase';
import { withTimeout } from './withTimeout';

export { newClientId } from './client-id';

type QueuedMutation = {
  id: string;
  path: string;
  method: string;
  body: string | null;
  queuedAt: number;
};

const QUEUE_PREFIX = 'cal2do-offline-queue-';
let syncRunning = false;

// 지금 서버로 전송 중(또는 전송 순서를 기다리는 중)인 큐 항목 id — 백그라운드 동기화가 같은 항목을 중복 전송하지 않게 함
const inflightIds = new Set<string>();
// 같은 주소(path)로 가는 쓰기를 한 줄로 세워서, 연달아 저장해도 서버에 "보낸 순서대로" 도착·반영되게 함
const pathChains = new Map<string, Promise<unknown>>();
// 서버가 최근에 확정해준 쓰기 기록 — 재조회가 그 쓰기와 겹쳐 낡은 값을 가져왔는지 판단하는 데 씀
const recentlySettled: { path: string; method: string; at: number }[] = [];
const SETTLED_KEEP_MS = 5 * 60 * 1000;

// 새 항목의 임시 id(temp-…) → 서버에 저장될 진짜 id. 새 항목 생성 요청을 만들 때 등록한다.
const tempToReal = new Map<string, string>();
// 아직 서버 확정 전인 "새 항목 생성" 요청의 결과(진짜 id → 결과). 그 항목의 수정/삭제는 이게 끝난 뒤에 보낸다.
const createOutcomes = new Map<string, Promise<SendOutcome>>();

const TEMP_PATH = /^(\/api\/(?:notes|todos|events)\/)(temp-[^/?#]+)(.*)$/;
const ITEM_PATH = /^\/api\/(?:notes|todos|events)\/([^/?#]+)/;
const realIdFromPath = (path: string): string | null => ITEM_PATH.exec(path)?.[1] ?? null;

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

/** 처리가 끝난 항목(id)만 큐에서 지운다. 큐 전체를 덮어쓰지 않으므로, 처리 도중 새로 쌓인 항목은 보존된다. */
function removeFromQueue(uid: string, ids: Iterable<string>) {
  const done = new Set(ids);
  if (done.size === 0) return;
  writeQueue(uid, readQueue(uid).filter((q) => !done.has(q.id)));
}

function noteSettled(path: string, method: string) {
  const now = Date.now();
  recentlySettled.push({ path, method: method.toUpperCase(), at: now });
  while (recentlySettled.length > 0 && now - recentlySettled[0].at > SETTLED_KEEP_MS) recentlySettled.shift();
}

/**
 * 재조회(bootstrap) 응답을 화면에 합칠 때 쓰는 보호 목록.
 * `since`(그 재조회를 시작한 시각) 이후에 서버 반영이 끝났거나, 아직 서버 반영이 끝나지 않은(전송 중/대기 중) 쓰기의 path를 돌려준다.
 * 이런 항목은 재조회 응답이 쓰기보다 "먼저 읽은" 낡은 값일 수 있어서, 화면의 최신 값을 서버 값으로 덮어쓰면 안 된다.
 */
export function getUnconfirmedWrites(since: number): { put: Set<string>; del: Set<string>; pendingTempIds: Set<string> } {
  const put = new Set<string>();
  const del = new Set<string>();
  // 아직 서버에 확정되지 않은 "새 항목 만들기" 요청이 화면에 임시로 띄워둔 항목들의 임시 id(요청 본문의 tempIds)
  const pendingTempIds = new Set<string>();
  const add = (path: string, method: string) => { (method.toUpperCase() === 'DELETE' ? del : put).add(path); };
  const uid = auth.currentUser?.uid;
  if (uid) {
    for (const q of readQueue(uid)) {
      add(q.path, q.method);
      if (q.method === 'POST' && q.body) {
        try { const t = JSON.parse(q.body)?.tempIds; if (Array.isArray(t)) t.forEach((x: unknown) => { if (typeof x === 'string') pendingTempIds.add(x); }); } catch { /* 무시 */ }
      }
    }
  }
  for (const s of recentlySettled) if (s.at >= since) add(s.path, s.method);
  return { put, del, pendingTempIds };
}

/** 앱이 미리 정한 id로 "한 번만" 저장하도록 보낸 생성 요청인지(재전송해도 중복이 안 생기므로 수정처럼 안전하게 재시도 가능) */
function isIdempotentCreate(method: string, body: string | null) {
  if (method !== 'POST' || !body) return false;
  try { const b = JSON.parse(body); return b?.idempotent === true && typeof b?.id === 'string'; } catch { return false; }
}

/** 큐에 남아 있는(아직 서버에 확정되지 않은) "새 항목 생성" 요청의 본문에서 진짜 id를 꺼낸다. */
function createdIdOf(m: { method: string; body: string | null }): string | null {
  if (m.method !== 'POST' || !m.body) return null;
  try { const b = JSON.parse(m.body); return b?.idempotent === true && typeof b?.id === 'string' ? b.id : null; } catch { return null; }
}

function hasPendingCreate(uid: string, id: string): boolean {
  return readQueue(uid).some((q) => createdIdOf(q) === id);
}

/**
 * 아직 서버 확정 전인 새 항목(temp-…)의 수정/삭제는 서버가 아는 "진짜 id" 경로로 바꿔 보낸다(서버엔 임시 id가 없어 404가 나기 때문).
 * 같은 실행 중이면 메모리에서, 앱을 껐다 켠 뒤면 기기에 남은 생성 요청의 tempIds에서 찾는다.
 * 진짜 id를 알 수 없는 임시 id(예: 할 일과 함께 만들어지는 연동 일정)는 그대로 둔다.
 */
function resolveTempPath(uid: string, path: string): string {
  const m = TEMP_PATH.exec(path);
  if (!m) return path;
  let real = tempToReal.get(m[2]);
  if (!real) {
    for (const q of readQueue(uid)) {
      if (q.method !== 'POST' || !q.body) continue;
      try {
        const b = JSON.parse(q.body);
        if (Array.isArray(b?.tempIds) && b.tempIds[0] === m[2] && typeof b.id === 'string') { real = b.id; break; }
      } catch { /* 무시 */ }
    }
  }
  return real ? `${m[1]}${real}${m[3]}` : path;
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

/** 큐에 넣고, 저장된 항목의 id를 돌려준다. */
function enqueueMutation(uid: string, path: string, method: string, body: string | null): string {
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
      return mutation.id;
    }
  }

  queue.push(mutation);
  writeQueue(uid, queue);
  return mutation.id;
}

function runSerialized<T>(path: string, task: () => Promise<T>): Promise<T> {
  const prev = pathChains.get(path) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  pathChains.set(path, next);
  next.finally(() => { if (pathChains.get(path) === next) pathChains.delete(path); }).catch(() => { /* 위 호출부가 처리 */ });
  return next;
}

type SendOutcome =
  | { outcome: 'ok'; data: any }
  // 서버가 요청 자체를 거절(검증 오류·없는 항목 등) — 다시 보내도 소용없음
  | { outcome: 'rejected'; status: number; message: string }
  // 네트워크 문제/시간초과/서버 일시 오류/인증 만료 — 나중에 다시 보내면 됨(쓰기가 전체 덮어쓰기라 재전송해도 안전)
  | { outcome: 'retry'; status?: number };

/** 큐 항목 하나를 서버로 보낸다. 토큰 만료(401)는 새 토큰으로 한 번 더 시도한다. */
async function sendMutation(m: QueuedMutation): Promise<SendOutcome> {
  let headers: Record<string, string>;
  try { headers = await authHeaders(); } catch { return { outcome: 'retry' }; }

  // keepalive: 저장 직후 앱이 백그라운드로 가거나 페이지가 닫혀도 브라우저가 요청을 끝까지 보내도록 함(본문 64KB 미만일 때만 가능)
  const bodySize = m.body ? new TextEncoder().encode(m.body).length : 0;
  const attempt = (h: Record<string, string>) => withTimeout(fetch(m.path, {
    method: m.method,
    headers: h,
    body: m.body || undefined,
    keepalive: bodySize < 60000,
  }));

  try {
    let res = await attempt(headers);
    if (res.status === 401) {
      try { res = await attempt(await authHeaders(true)); } catch { return { outcome: 'retry', status: 401 }; }
    }
    if (res.ok) {
      let data: any = { ok: true };
      try { data = await res.json(); } catch { /* 본문이 없어도 성공 */ }
      return { outcome: 'ok', data };
    }
    if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) return { outcome: 'retry', status: res.status };
    let message = `요청 실패 (${res.status})`;
    try { const data = await res.json(); if (data?.error) message = data.error; } catch { /* 무시 */ }
    return { outcome: 'rejected', status: res.status, message };
  } catch {
    return { outcome: 'retry' };
  }
}

async function syncPendingMutations() {
  if (syncRunning || typeof window === 'undefined' || !navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;

  const snapshot = readQueue(uid).filter((q) => !inflightIds.has(q.id));
  if (snapshot.length === 0) return;

  syncRunning = true;
  let changed = false;
  const doneIds = new Set<string>();
  const blockedPaths = new Set<string>();
  // 생성이 아직 서버에 못 간 항목 id — 그 항목의 수정/삭제를 먼저 보내면 404로 버려지므로 함께 보류한다
  const blockedItemIds = new Set<string>();
  try {
    for (const mutation of snapshot) {
      if (inflightIds.has(mutation.id)) continue;
      // 앞선 같은 항목의 쓰기가 아직 못 나갔다면, 순서를 지키기 위해 이 항목도 건너뜀
      if (blockedPaths.has(mutation.path)) continue;
      if (mutation.method !== 'POST') {
        const itemId = realIdFromPath(mutation.path);
        if (itemId && blockedItemIds.has(itemId)) continue;
      }

      inflightIds.add(mutation.id);
      let result: SendOutcome;
      try { result = await runSerialized(mutation.path, () => sendMutation(mutation)); }
      finally { inflightIds.delete(mutation.id); }

      if (result.outcome === 'ok') {
        doneIds.add(mutation.id);
        noteSettled(mutation.path, mutation.method);
        changed = true;
      } else if (result.outcome === 'rejected') {
        // UI에서 이미 검증된 데이터이므로 이 경우는 서버 규칙 변경 등 비정상 상황이다.
        // 무한 재시도로 앱을 막지 않도록 해당 항목만 폐기한다.
        console.error('[offline] 동기화 거부:', mutation.path, result.status, result.message);
        doneIds.add(mutation.id);
        changed = true;
      } else if (result.status === undefined) {
        // 네트워크 오류/타임아웃: 아직 연결이 불안정하므로 이번 동기화는 여기서 멈추고 다음 기회에 이어서 보냄
        break;
      } else {
        // 서버 일시 오류(5xx 등): 이 항목은 남겨두되, 다른 항목까지 막지는 않음(같은 항목의 뒤 쓰기만 순서상 보류)
        blockedPaths.add(mutation.path);
        const createdId = createdIdOf(mutation);
        if (createdId) blockedItemIds.add(createdId);
      }

      if (!navigator.onLine) break;
    }
  } catch (err) {
    console.error('[offline] 동기화 실패:', err);
  } finally {
    // 처리한 항목만 지움 — 동기화 도중 새로 쌓인 항목은 그대로 남음
    removeFromQueue(uid, doneIds);
    syncRunning = false;
  }
  if (changed) dispatchSyncComplete();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void syncPendingMutations(); });
  // 앱을 다시 열었을 때 이미 온라인이면 남아 있던 큐를 백그라운드에서 비운다.
  setTimeout(() => { void syncPendingMutations(); }, 1000);
  // 백그라운드에 있다가 앱으로 돌아왔을 때도 못 보낸 저장이 있으면 바로 이어서 보낸다.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncPendingMutations(); });
}

async function authHeaders(forceRefresh = false): Promise<Record<string, string>> {
  if (!auth.currentUser) {
    try { await auth.authStateReady(); } catch { /* ignore */ }
  }
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  let token: string;
  try {
    token = await user.getIdToken(forceRefresh);
  } catch {
    await new Promise((r) => setTimeout(r, 700));
    token = await user.getIdToken(forceRefresh);
  }
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request(path: string, options: RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? options.body : null;
  const user = auth.currentUser;

  // 수정/삭제(PUT·PATCH·DELETE)와, 미리 정한 id로 보내는 새 항목 생성(idempotent POST)은
  // "먼저 기기에 기록(outbox) → 서버 전송 → 확정되면 기록 삭제" 순서로 처리한다.
  // 저장 직후 앱이 꺼지거나 백그라운드로 가거나, 네트워크가 끊기거나 시간초과가 나도 기록은 남아 있어서
  // 다음 실행/복귀/온라인 복귀 때 자동으로 다시 서버에 반영된다(전체 덮어쓰기/같은 id는 한 번만 저장이라 재전송해도 안전).
  if (user && isQueueableMutation(path, method) && (method !== 'POST' || isIdempotentCreate(method, body)) && typeof window !== 'undefined') {
    const uid = user.uid;
    // 아직 서버 확정 전인 새 항목(temp-…)의 수정/삭제는 서버가 아는 진짜 id 경로로 바꿔 보낸다.
    if (method !== 'POST') path = resolveTempPath(uid, path);
    const qid = enqueueMutation(uid, path, method, body);
    if (!navigator.onLine) return { queued: true };

    // 전송 순서를 기다리는 동안에도 "전송 중"으로 표시해, 백그라운드 동기화가 이 항목을 먼저 보내버리지 않게 한다.
    inflightIds.add(qid);
    let createdId: string | null = null;
    try {
      if (method === 'POST') {
        const b = JSON.parse(body as string);
        createdId = b.id;
        const tempSelf = Array.isArray(b.tempIds) ? b.tempIds[0] : null;
        if (typeof tempSelf === 'string' && tempSelf.startsWith('temp-')) tempToReal.set(tempSelf, b.id);
      } else {
        // 이 항목의 "새로 만들기"가 아직 서버에 확정되지 않았다면, 그게 끝난 뒤에 수정/삭제를 보낸다.
        const targetId = realIdFromPath(path);
        if (targetId) {
          const pendingCreate = createOutcomes.get(targetId);
          if (pendingCreate) {
            const created = await pendingCreate;
            if (created.outcome === 'rejected') {
              removeFromQueue(uid, [qid]);
              const err: any = new Error('새 항목이 저장되지 않아 수정할 수 없습니다.');
              err.status = created.status;
              throw err;
            }
            if (created.outcome === 'retry') return { queued: true }; // 생성이 아직 대기 중 — 기록은 큐에 남고, 동기화가 생성 → 수정 순서로 보냄
          } else if (hasPendingCreate(uid, targetId)) {
            // 앱을 껐다 켠 뒤라 생성 요청이 아직 큐에 남아 있음 — 동기화가 큐 순서(생성 → 수정)대로 보낸다.
            inflightIds.delete(qid);
            void syncPendingMutations();
            return { queued: true };
          }
        }
      }

      const sending = runSerialized(path, () => sendMutation({ id: qid, path, method, body, queuedAt: Date.now() }));
      if (createdId) createOutcomes.set(createdId, sending.catch((): SendOutcome => ({ outcome: 'retry' })));
      const result: SendOutcome = await sending;

      if (result.outcome === 'ok') {
        removeFromQueue(uid, [qid]);
        noteSettled(path, method);
        void syncPendingMutations();
        return result.data;
      }
      if (result.outcome === 'rejected') {
        removeFromQueue(uid, [qid]);
        const err: any = new Error(result.message);
        err.status = result.status;
        throw err;
      }
      // 아직 서버에 확정되지 않음 — 기록은 남겨두고 자동 재시도. 호출부는 queued 여부로 안내 문구를 구분한다.
      return { queued: true };
    } finally {
      inflightIds.delete(qid);
      if (createdId) createOutcomes.delete(createdId);
    }
  }

  // 오프라인 쓰기(생성 등)는 인증 토큰 갱신조차 시도하지 않고 즉시 로컬 큐에 넣는다.
  // 그래야 인터넷이 끊긴 순간 Firebase 토큰이 만료돼 있어도 작업을 잃지 않는다.
  if (user && isQueueableMutation(path, method) && typeof window !== 'undefined' && !navigator.onLine) {
    enqueueMutation(user.uid, path, method, body);
    return { queued: true };
  }

  // 앱 시작/새로고침 때 서버 스냅샷을 가져오기 전에 대기 중인 로컬 변경부터 밀어 넣는다.
  // 그래야 오프라인에서 수정한 값이 서버의 오래된 값으로 잠깐 덮어써지는 일이 없다.
  if (user && method === 'GET' && typeof window !== 'undefined' && navigator.onLine) {
    await syncPendingMutations();
  }

  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
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
