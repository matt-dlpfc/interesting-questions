import type { Question } from './questions';

// Calls to our own API (netlify/functions). Network failures are reported as 'offline', never thrown.

export type Result<T> = { ok: true; data: T } | { ok: false; reason: 'unauthorized' | 'rejected' | 'offline' };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    if (res.status === 401) return { ok: false, reason: 'unauthorized' };
    if (res.status >= 500) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'rejected' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

export interface Me {
  isAdmin: boolean;
}

export const getMe = () => call<Me>('/api/me');

export const login = (code: string) => call<Me>('/api/login', { method: 'POST', body: JSON.stringify({ code }) });

export const logout = () => call<{ ok: true }>('/api/logout', { method: 'POST' });

export const getQuestions = () => call<{ questions: Question[] }>('/api/questions');
