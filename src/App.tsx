import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getMe, getMySubmissions, login, logout, submitQuestion, type Submission } from './api';
import {
  DEPTHS,
  SITUATIONS,
  buildSession,
  cachedPool,
  candidates,
  fetchPool,
  forgetPool,
  pickReplacement,
  type Depth,
  type Intensity,
  type LastSeen,
  type Question,
  type Situation,
} from './questions';
import { addRating, markRatingsSynced, syncRatings } from './ratings';
import { load, save } from './storage';
import { useWakeLock } from './wakeLock';

type Screen =
  | { name: 'home' }
  | { name: 'suggest' }
  | { name: 'session'; situation: Situation; round: number }
  | { name: 'done'; situation: Situation; count: number };

// 'checking' only shows on a device that has never entered a code; a remembered one opens straight away.
type Access = 'checking' | 'locked' | 'in';

export default function App() {
  const [access, setAccess] = useState<Access>(() => (load<boolean>('member', false) ? 'in' : 'checking'));
  const [offline, setOffline] = useState(false);

  function lock() {
    save('member', false);
    forgetPool();
    setAccess('locked');
  }

  function enter() {
    save('member', true);
    setOffline(false);
    setAccess('in');
  }

  // Re-check in the background: a revoked code locks the device, but being offline doesn't.
  useEffect(() => {
    getMe().then((res) => {
      if (res.ok) enter();
      else if (res.reason === 'unauthorized') lock();
      else if (!load<boolean>('member', false)) {
        setOffline(true);
        setAccess('locked');
      }
    });
  }, []);

  async function forgetDevice() {
    markRatingsSynced();
    await logout();
    lock();
  }

  if (access === 'checking') return <main className="screen" aria-busy="true" />;
  if (access === 'locked') return <CodeGate offline={offline} onEnter={enter} />;
  return <Pool onForget={forgetDevice} />;
}

function CodeGate({ offline, onEnter }: { offline: boolean; onEnter: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(offline ? 'You’re offline. Connect to enter your code.' : '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setMessage('');
    const res = await login(code);
    setBusy(false);
    if (res.ok) onEnter();
    else if (res.reason === 'offline') setMessage('Can’t reach the server. Check your connection and try again.');
    else setMessage('That code didn’t work. Check it and try again.');
  }

  return (
    <main className="screen gate">
      <header>
        <h1>Interesting Questions</h1>
        <p className="muted">Enter your invite code.</p>
      </header>

      <form onSubmit={submit}>
        <label htmlFor="code" className="eyebrow">
          Invite code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. tiger-ferry-lamp-42"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-describedby="code-message"
        />
        <p id="code-message" className="small gate-message" role="status">
          {message}
        </p>
        <button type="submit" className="primary" disabled={busy || !code.trim()}>
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>

      <footer className="muted small">
        Codes are personal. This device will remember yours. Lost it? Ask whoever invited you.
      </footer>
    </main>
  );
}

function Pool({ onForget }: { onForget: () => void }) {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [depth, setDepth] = useState<Depth>(() => load<Depth>('depth', 'mixed'));
  const [pool, setPool] = useState<Question[]>(cachedPool);

  useEffect(() => save('depth', depth), [depth]);

  // Every screen starts at the top, not at the previous screen's scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen.name]);

  // Catch up whenever there's a connection: new questions in, unsent ratings out.
  useEffect(() => {
    const refresh = () => {
      fetchPool().then((fresh) => fresh && setPool(fresh));
      void syncRatings();
    };
    refresh();
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, []);

  const goHome = () => setScreen({ name: 'home' });
  const start = (situation: Situation) => setScreen({ name: 'session', situation, round: Date.now() });

  if (screen.name === 'session') {
    return (
      <Session
        key={screen.round}
        pool={pool}
        situation={screen.situation}
        depth={depth}
        onLeave={goHome}
        onDone={(count) => setScreen({ name: 'done', situation: screen.situation, count })}
      />
    );
  }

  if (screen.name === 'suggest') return <Suggest onBack={goHome} />;

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

  return (
    <Home
      pool={pool}
      depth={depth}
      onDepth={setDepth}
      onStart={start}
      onSuggest={() => setScreen({ name: 'suggest' })}
      onForget={onForget}
    />
  );
}

function labelFor(situation: Situation): string {
  return SITUATIONS.find((s) => s.id === situation)?.label ?? situation;
}

function Home({
  pool,
  depth,
  onDepth,
  onStart,
  onSuggest,
  onForget,
}: {
  pool: Question[];
  depth: Depth;
  onDepth: (d: Depth) => void;
  onStart: (s: Situation) => void;
  onSuggest: () => void;
  onForget: () => void;
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
            const empty = candidates(pool, s.id, depth).length === 0;
            return (
              <button key={s.id} className="situation" disabled={empty} onClick={() => onStart(s.id)}>
                {s.label}
                {empty && <span className="muted small"> · none yet</span>}
              </button>
            );
          })}
        </div>
      </section>

      <button className="ghost" onClick={onSuggest}>
        Suggest a question
      </button>

      <footer className="muted small">
        <p>Nothing you say is recorded. Ratings are shared anonymously with the group.</p>
        <button className="link-btn" onClick={onForget}>
          Forget this device
        </button>
      </footer>
    </main>
  );
}

function Session({
  pool,
  situation,
  depth,
  onLeave,
  onDone,
}: {
  pool: Question[];
  situation: Situation;
  depth: Depth;
  onLeave: () => void;
  onDone: (count: number) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>(() =>
    buildSession(pool, situation, depth, load<LastSeen>('lastSeen', {})),
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
    addRating({ questionId: current.id, rating, situation, at: Date.now() });
    setRating(null);
  }

  function next() {
    commitRating();
    if (index + 1 >= questions.length) onDone(questions.length);
    else setIndex(index + 1);
  }

  function swap() {
    commitRating();
    const replacement = pickReplacement(pool, situation, depth, current, used.current, load<LastSeen>('lastSeen', {}));
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

const INTENSITY_OPTIONS: { id: Intensity; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'deep', label: 'Deep' },
];

// Suggest a question for the pool, and see what happened to earlier suggestions (D4).
function Suggest({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [situations, setSituations] = useState<Situation[]>([]);
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [topics, setTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mine, setMine] = useState<Submission[] | 'offline' | null>(null);

  useEffect(() => {
    getMySubmissions().then((res) => setMine(res.ok ? res.data.submissions : 'offline'));
  }, []);

  const ready = text.trim().length >= 10 && situations.length > 0 && intensity !== null;

  function toggle(s: Situation) {
    setSituations(situations.includes(s) ? situations.filter((x) => x !== s) : [...situations, s]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy || intensity === null) return;
    setBusy(true);
    setMessage('');
    const res = await submitQuestion({
      text,
      situations,
      intensity,
      suggestedTags: topics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setBusy(false);
    if (res.ok) {
      setText('');
      setSituations([]);
      setIntensity(null);
      setTopics('');
      setMessage('Thanks! It will appear in sessions once it’s approved.');
      setMine((prev) => [res.data.submission, ...(Array.isArray(prev) ? prev : [])]);
    } else if (res.reason === 'offline') setMessage('Can’t reach the server. Check your connection and try again.');
    else setMessage(res.message ?? 'That didn’t work. Try again.');
  }

  return (
    <main className="screen suggest">
      <header className="session-bar">
        <button className="ghost small-btn" onClick={onBack}>
          ← Back
        </button>
      </header>

      <form onSubmit={submit}>
        <h1>Suggest a question</h1>
        <p className="muted small">Every suggestion is reviewed before it reaches the pool. Nobody sees who wrote it.</p>

        <label htmlFor="suggest-text" className="eyebrow">
          Question
        </label>
        <textarea
          id="suggest-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="What’s a question you love being asked?"
        />

        <p id="suggest-who" className="eyebrow">
          Good for
        </p>
        <div className="chips" role="group" aria-labelledby="suggest-who">
          {SITUATIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={situations.includes(s.id)}
              className={situations.includes(s.id) ? 'selected' : ''}
              onClick={() => toggle(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p id="suggest-depth" className="eyebrow">
          How deep?
        </p>
        <div className="segmented" role="radiogroup" aria-labelledby="suggest-depth">
          {INTENSITY_OPTIONS.map((i) => (
            <button
              key={i.id}
              type="button"
              role="radio"
              aria-checked={intensity === i.id}
              className={intensity === i.id ? 'selected' : ''}
              onClick={() => setIntensity(i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>

        <label htmlFor="suggest-topics" className="eyebrow">
          Topics <span className="optional">Optional</span>
        </label>
        <input
          id="suggest-topics"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="e.g. childhood, travel"
          autoCapitalize="none"
        />

        <p className="small form-message" role="status">
          {message}
        </p>
        <button type="submit" className="primary" disabled={!ready || busy}>
          {busy ? 'Sending…' : 'Send for review'}
        </button>
      </form>

      <section aria-labelledby="mine-label">
        <p id="mine-label" className="eyebrow">
          Your suggestions
        </p>
        {mine === null && <p className="muted small">Loading…</p>}
        {mine === 'offline' && <p className="muted small">Can’t load these right now.</p>}
        {Array.isArray(mine) && mine.length === 0 && <p className="muted small">None yet.</p>}
        {Array.isArray(mine) && mine.length > 0 && (
          <ul className="submissions">
            {mine.map((s) => (
              <li key={s.id}>
                <span>{s.text}</span>
                <span className={`status ${s.status}`}>
                  {s.status === 'approved' ? 'In the pool' : 'Waiting for review'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
