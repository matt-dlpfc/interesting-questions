import data from '../content/questions.json';

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

export const QUESTIONS = data.questions as Question[];

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

export function candidates(situation: Situation, depth: Depth): Question[] {
  return QUESTIONS.filter((q) => q.situations.includes(situation) && fitsDepth(depth, q.intensity));
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
export function buildSession(situation: Situation, depth: Depth, lastSeen: LastSeen): Question[] {
  const pool = shuffle(candidates(situation, depth)).sort((a, b) => seenAt(lastSeen, a) - seenAt(lastSeen, b));
  return pool.slice(0, SESSION_LENGTH).sort((a, b) => RANK[a.intensity] - RANK[b.intensity]);
}

// A stand-in for a skipped question: same intensity if possible, least recently seen.
export function pickReplacement(
  situation: Situation,
  depth: Depth,
  current: Question,
  exclude: Set<string>,
  lastSeen: LastSeen,
): Question | undefined {
  const differs = (q: Question) => (q.intensity === current.intensity ? 0 : 1);
  return shuffle(candidates(situation, depth).filter((q) => !exclude.has(q.id))).sort(
    (a, b) => differs(a) - differs(b) || seenAt(lastSeen, a) - seenAt(lastSeen, b),
  )[0];
}
