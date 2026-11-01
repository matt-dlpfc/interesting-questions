// The fixed situations and intensities (D8), from the same file the starter questions live in,
// and the checks shared by suggesting a question and approving one.
import data from '../../content/questions.json';

export const SITUATIONS: readonly string[] = data.situations;
export const INTENSITIES: readonly string[] = data.intensities;

const MAX_TOPICS = 5;

export interface QuestionFields {
  text: string;
  situations: string[];
  intensity: string;
}

// Returns the cleaned fields, or a message saying what's wrong.
export function parseQuestionFields(body: Record<string, unknown> | null): QuestionFields | string {
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  if (text.length < 10 || text.length > 300) return 'A question should be 10–300 characters';

  const situations = Array.isArray(body?.situations) ? [...new Set(body.situations)] : [];
  if (situations.length === 0 || !situations.every((s) => SITUATIONS.includes(s as string))) {
    return 'Pick at least one situation';
  }

  const intensity = body?.intensity;
  if (typeof intensity !== 'string' || !INTENSITIES.includes(intensity)) return 'Pick how deep it is';

  return { text, situations: situations as string[], intensity };
}

// Lowercase, simple characters, no duplicates, at most five.
export function cleanTopics(value: unknown): string[] {
  const topics = (Array.isArray(value) ? value : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .trim(),
    )
    .filter((t) => t.length > 0 && t.length <= 24);
  return [...new Set(topics)].slice(0, MAX_TOPICS);
}
