import data from '../content/questions.json';
import { load, save } from './storage';

export type Intensity = 'light' | 'medium' | 'deep';
export type Situation = 'just-met' | 'date' | 'friends' | 'old-friends' | 'group' | 'family' | 'work';
export type Depth = 'light' | 'mixed' | 'deep';

export interface Question {
  id: string;
  text: string;
  topics: string[];
  situations: Situation[];
  intensity: Intensity;
}

// The bundled starter set: only a fallback for when the shared pool has never been fetched on this device.
const STARTER = data.questions as Question[];

export const SESSION_LENGTH = 5;

export const SITUATIONS: { id: Situation; label: string }[] = [
  { id: 'just-met', label: 'Someone new' },
  { id: 'date', label: 'A date' },
  { id: 'friends', label: 'Friends' },
  { id: 'old-friends', label: 'Old friends' },
  { id: 'group', label: 'A group' },
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work' },
];

export const DEPTHS: { id: Depth; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'deep', label: 'Deep' },
];

// When each question was last shown on this device: id → timestamp.
export type LastSeen = Record<string, number>;

const RANK: Record<Intensity, number> = { light: 0, medium: 1, deep: 2 };

function fitsDepth(depth: Depth, intensity: Intensity): boolean {
  if (depth === 'light') return intensity === 'light';
  if (depth === 'deep') return intensity !== 'light';
  return true;
}

// The last pool fetched from the server, so sessions work offline.
export function cachedPool(): Question[] {
  const cached = load<Question[]>('pool', []);
  return cached.length > 0 ? cached : STARTER;
}

// Fetches the shared pool and caches it. Returns null when offline or the server is unavailable.
export async function fetchPool(): Promise<Question[] | null> {
  try {
    const res = await fetch('/api/questions');
    if (!res.ok) return null;
    const { questions } = (await res.json()) as { questions: Question[] };
    if (questions.length === 0) return null;
    save('pool', questions);
    return questions;
  } catch {
    return null;
  }
}

export function candidates(pool: Question[], situation: Situation, depth: Depth): Question[] {
  return pool.filter((q) => q.situations.includes(situation) && fitsDepth(depth, q.intensity));
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const seenAt = (lastSeen: LastSeen, q: Question) => lastSeen[q.id] ?? 0;

// Picks up to SESSION_LENGTH questions, preferring ones not seen recently,
// then orders them light → deep so the conversation warms up gradually.
export function buildSession(
  pool: Question[],
  situation: Situation,
  depth: Depth,
  lastSeen: LastSeen,
): Question[] {
  const picked = shuffle(candidates(pool, situation, depth)).sort((a, b) => seenAt(lastSeen, a) - seenAt(lastSeen, b));
  return picked.slice(0, SESSION_LENGTH).sort((a, b) => RANK[a.intensity] - RANK[b.intensity]);
}

// A stand-in for a skipped question: same intensity if possible, least recently seen.
export function pickReplacement(
  pool: Question[],
  situation: Situation,
  depth: Depth,
  current: Question,
  exclude: Set<string>,
  lastSeen: LastSeen,
): Question | undefined {
  const differs = (q: Question) => (q.intensity === current.intensity ? 0 : 1);
  return shuffle(candidates(pool, situation, depth).filter((q) => !exclude.has(q.id))).sort(
    (a, b) => differs(a) - differs(b) || seenAt(lastSeen, a) - seenAt(lastSeen, b),
  )[0];
}
