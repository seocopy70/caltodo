import { auth } from './firebase';
import { withTimeout } from './withTimeout';

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request(path: string, options: RequestInit = {}) {
  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
  const res = await withTimeout(fetch(path, { ...options, headers }));
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
