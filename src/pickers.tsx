// Form pickers shared by "Suggest a question" and the admin's approval queue.
import { SITUATIONS, type Intensity, type Situation } from './questions';

const INTENSITY_OPTIONS: { id: Intensity; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'deep', label: 'Deep' },
];

export function SituationChips({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: Situation[];
  onChange: (value: Situation[]) => void;
}) {
  const toggle = (s: Situation) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <div className="chips" role="group" aria-labelledby={labelId}>
      {SITUATIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={value.includes(s.id)}
          className={value.includes(s.id) ? 'selected' : ''}
          onClick={() => toggle(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function IntensityPicker({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: Intensity | null;
  onChange: (value: Intensity) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
      {INTENSITY_OPTIONS.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={value === i.id}
          className={value === i.id ? 'selected' : ''}
          onClick={() => onChange(i.id)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

// "childhood, travel" ⇄ ['childhood', 'travel']
export const parseTopics = (text: string) =>
  text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
