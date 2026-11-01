import type { Intensity, Question, Situation } from './questions';
import type { Rating } from './ratings';

// Calls to our own API (netlify/functions). Network failures are reported as 'offline', never thrown.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unauthorized' | 'rejected' | 'offline'; message?: string };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    if (res.status === 401) return { ok: false, reason: 'unauthorized' };
    if (res.status >= 500) return { ok: false, reason: 'offline' };
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, reason: 'rejected', message: body?.error };
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

export const putRatings = (ratings: Rating[]) =>
  call<{ saved: number }>('/api/ratings', { method: 'PUT', body: JSON.stringify({ ratings }) });

export interface Submission {
  id: string;
  text: string;
  status: 'pending' | 'approved';
  created_at: string;
}

export interface NewSubmission {
  text: string;
  situations: Situation[];
  intensity: Intensity;
  suggestedTags: string[];
}

export const getMySubmissions = () => call<{ submissions: Submission[] }>('/api/submissions');

export const submitQuestion = (submission: NewSubmission) =>
  call<{ submission: Submission }>('/api/submissions', { method: 'POST', body: JSON.stringify(submission) });
