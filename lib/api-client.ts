import { auth } from './firebase';
import { withTimeout } from './withTimeout';

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  // getIdToken()은 만료된 토큰이면 내부적으로 구글 인증 서버로 갱신 요청을 보낸다.
  // 이 호출이 순간적인 연결 끊김으로 실패하는 경우가 있어(요청이 서버까지 가지도 못함),
  // 한 번만 조용히 재시도해서 "저장 실패"로 바로 이어지지 않게 한다.
  let token: string;
  try {
    token = await user.getIdToken();
  } catch (err) {
    await new Promise((r) => setTimeout(r, 700));
    token = await user.getIdToken();
  }
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request(path: string, options: RequestInit = {}) {
  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
  const doFetch = () => withTimeout(fetch(path, { ...options, headers }));

  let res: Response;
  try {
    res = await doFetch();
  } catch (err: any) {
    // withTimeout이 던진 타임아웃은 서버가 이미 요청을 처리하고 있을 수 있어 재시도하면
    // 중복 저장 위험이 있으므로 그대로 던진다. 반면 순수 네트워크 예외(TypeError:
    // Failed to fetch 등)는 요청이 아예 서버로 나가지도 못한 경우가 대부분이라, 잠깐
    // 기다렸다 한 번만 재시도해서 순간적인 연결 끊김을 사용자가 못 느끼게 한다.
    if (err?.isTimeout) throw err;
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
