import { useEffect, useRef, useState } from 'react';
import {
  DEPTHS,
  SITUATIONS,
  buildSession,
  candidates,
  pickReplacement,
  type Depth,
  type LastSeen,
  type Question,
  type Situation,
} from './questions';
import { load, save } from './storage';
import { useWakeLock } from './wakeLock';

// A rating given on this device. Kept locally until Phase 2 adds a shared pool.
interface Rating {
  questionId: string;
  rating: number;
  situation: Situation;
  at: number;
}

type Screen =
  | { name: 'home' }
  | { name: 'session'; situation: Situation; round: number }
  | { name: 'done'; situation: Situation; count: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [depth, setDepth] = useState<Depth>(() => load<Depth>('depth', 'mixed'));

  useEffect(() => save('depth', depth), [depth]);

  const goHome = () => setScreen({ name: 'home' });
  const start = (situation: Situation) => setScreen({ name: 'session', situation, round: Date.now() });

  if (screen.name === 'session') {
    return (
      <Session
        key={screen.round}
        situation={screen.situation}
        depth={depth}
        onLeave={goHome}
        onDone={(count) => setScreen({ name: 'done', situation: screen.situation, count })}
      />
    );
  }

  if (screen.name === 'done') {
    return (
      <main className="screen done">
        <div className="done-body">
          <p className="eyebrow">{labelFor(screen.situation)}</p>
          <h1>That's {screen.count}.</h1>
          <p className="muted">Keep talking, or go another round.</p>
        </div>
        <div className="actions stacked">
          <button className="primary" onClick={() => start(screen.situation)}>
            Another round
          </button>
          <button className="ghost" onClick={goHome}>
            Change setting
          </button>
        </div>
      </main>
    );
  }

  return <Home depth={depth} onDepth={setDepth} onStart={start} />;
}

function labelFor(situation: Situation): string {
  return SITUATIONS.find((s) => s.id === situation)?.label ?? situation;
}

function Home({
  depth,
  onDepth,
  onStart,
}: {
  depth: Depth;
  onDepth: (d: Depth) => void;
  onStart: (s: Situation) => void;
}) {
  return (
    <main className="screen home">
      <header>
        <h1>Interesting Questions</h1>
        <p className="muted">One at a time.</p>
      </header>

      <section aria-labelledby="depth-label">
        <p id="depth-label" className="eyebrow">
          How deep?
        </p>
        <div className="segmented" role="radiogroup" aria-labelledby="depth-label">
          {DEPTHS.map((d) => (
            <button
              key={d.id}
              role="radio"
              aria-checked={depth === d.id}
              className={depth === d.id ? 'selected' : ''}
              onClick={() => onDepth(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="who-label">
        <p id="who-label" className="eyebrow">
          Who are you with?
        </p>
        <div className="situations">
          {SITUATIONS.map((s) => {
            const empty = candidates(s.id, depth).length === 0;
            return (
              <button key={s.id} className="situation" disabled={empty} onClick={() => onStart(s.id)}>
                {s.label}
                {empty && <span className="muted small"> · none yet</span>}
              </button>
            );
          })}
        </div>
      </section>

      <footer className="muted small">Nothing you say is recorded. Ratings stay on this device.</footer>
    </main>
  );
}

function Session({
  situation,
  depth,
  onLeave,
  onDone,
}: {
  situation: Situation;
  depth: Depth;
  onLeave: () => void;
  onDone: (count: number) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>(() =>
    buildSession(situation, depth, load<LastSeen>('lastSeen', {})),
  );
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  // Everything shown this session, including skipped ones, so a swap never brings one back.
  const used = useRef(new Set(questions.map((q) => q.id)));

  useWakeLock(true);

  const current = questions[index];

  useEffect(() => {
    if (!current) return;
    const seen = load<LastSeen>('lastSeen', {});
    seen[current.id] = Date.now();
    save('lastSeen', seen);
  }, [current?.id]);

  function commitRating() {
    if (rating === null || !current) return;
    const all = load<Rating[]>('ratings', []);
    all.push({ questionId: current.id, rating, situation, at: Date.now() });
    save('ratings', all);
    setRating(null);
  }

  function next() {
    commitRating();
    if (index + 1 >= questions.length) onDone(questions.length);
    else setIndex(index + 1);
  }

  function swap() {
    commitRating();
    const replacement = pickReplacement(situation, depth, current, used.current, load<LastSeen>('lastSeen', {}));
    if (replacement) {
      used.current.add(replacement.id);
      setQuestions(questions.map((q, i) => (i === index ? replacement : q)));
      return;
    }
    // Nothing left to swap in: drop this one instead.
    const rest = questions.filter((_, i) => i !== index);
    if (rest.length === 0) onLeave();
    else if (index >= rest.length) onDone(rest.length);
    else setQuestions(rest);
  }

  function leave() {
    commitRating();
    onLeave();
  }

  if (!current) {
    return (
      <main className="screen done">
        <div className="done-body">
          <h1>No questions here yet.</h1>
        </div>
        <div className="actions stacked">
          <button className="primary" onClick={onLeave}>
            Back
          </button>
        </div>
      </main>
    );
  }

  const isLast = index + 1 >= questions.length;

  return (
    <main className="screen session">
      <header className="session-bar">
        <button className="ghost small-btn" onClick={leave} aria-label="Leave session">
          ✕ Leave
        </button>
        <span className="muted" aria-live="polite">
          {index + 1} / {questions.length}
        </span>
      </header>

      <div className="question-wrap">
        <p className="eyebrow">{labelFor(situation)}</p>
        <h1 key={current.id} className="question">
          {current.text}
        </h1>
      </div>

      <section className="rating" aria-labelledby="rating-label">
        <p id="rating-label" className="muted small">
          How was this one? <span className="optional">Optional</span>
        </p>
        <div className="rating-grid" role="radiogroup" aria-labelledby="rating-label">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rating === n}
              className={rating === n ? 'selected' : ''}
              onClick={() => setRating(rating === n ? null : n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <div className="actions">
        <button className="ghost" onClick={swap}>
          Swap
        </button>
        <button className="primary" onClick={next}>
          {isLast ? 'Finish' : 'Next →'}
        </button>
      </div>
    </main>
  );
}
