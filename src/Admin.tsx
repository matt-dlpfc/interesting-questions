// The admin's screen: review suggested questions (D4), manage invite codes (D1, D3)
// and bulk-import the admin's own questions.
import { useEffect, useState, type FormEvent } from 'react';
import {
  approveQuestion,
  createInvite,
  getInvites,
  getQueue,
  hideQuestion,
  importQuestions,
  revokeInvite,
  type Approval,
  type Invite,
  type PendingQuestion,
  type Result,
} from './api';
import { IntensityPicker, SituationChips, parseTopics } from './pickers';
import { SITUATIONS, type Intensity, type Situation } from './questions';

type Tab = 'review' | 'codes' | 'import';

const OFFLINE = 'Can’t reach the server. Check your connection and try again.';

function failure(res: Result<unknown>): string {
  if (res.ok) return '';
  return res.reason === 'offline' ? OFFLINE : (res.message ?? 'That didn’t work. Try again.');
}

export function Admin({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('review');
  const [queue, setQueue] = useState<PendingQuestion[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getQueue().then((res) => (res.ok ? setQueue(res.data.questions) : setError(failure(res))));
  }, []);

  const removeFromQueue = (id: string) => setQueue((q) => q?.filter((x) => x.id !== id) ?? null);

  return (
    <main className="screen admin">
      <header className="session-bar">
        <button className="ghost small-btn" onClick={onBack}>
          ← Back
        </button>
      </header>

      <h1>Admin</h1>

      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'review'}
          className={tab === 'review' ? 'selected' : ''}
          onClick={() => setTab('review')}
        >
          Review{queue && queue.length > 0 ? ` (${queue.length})` : ''}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'codes'}
          className={tab === 'codes' ? 'selected' : ''}
          onClick={() => setTab('codes')}
        >
          Codes
        </button>
        <button
          role="tab"
          aria-selected={tab === 'import'}
          className={tab === 'import' ? 'selected' : ''}
          onClick={() => setTab('import')}
        >
          Import
        </button>
      </div>

      {tab === 'review' && (
        <section className="stack" aria-label="Suggestions waiting for review">
          {error && <p className="muted small">{error}</p>}
          {!error && queue === null && <p className="muted small">Loading…</p>}
          {queue?.length === 0 && <p className="muted small">Nothing waiting for review.</p>}
          {queue?.map((q) => (
            <ReviewCard key={q.id} question={q} onDone={() => removeFromQueue(q.id)} />
          ))}
        </section>
      )}

      {tab === 'codes' && <Codes />}
      {tab === 'import' && <Import />}
    </main>
  );
}

// One suggestion: fix it up if needed, then approve or hide.
function ReviewCard({ question, onDone }: { question: PendingQuestion; onDone: () => void }) {
  const [text, setText] = useState(question.text);
  const [situations, setSituations] = useState<Situation[]>(question.situations);
  const [intensity, setIntensity] = useState<Intensity>(question.intensity);
  const [topics, setTopics] = useState(question.suggested_tags.join(', '));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const ids = `review-${question.id}`;

  async function act(action: () => Promise<Result<unknown>>) {
    setBusy(true);
    setMessage('');
    const res = await action();
    setBusy(false);
    if (res.ok) onDone();
    else setMessage(failure(res));
  }

  const approve = () =>
    act(() => approveQuestion(question.id, { text, situations, intensity, topics: parseTopics(topics) }));
  const hide = () => act(() => hideQuestion(question.id));

  return (
    <article className="card">
      <label htmlFor={`${ids}-text`} className="eyebrow">
        Question
      </label>
      <textarea id={`${ids}-text`} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} />

      <p id={`${ids}-who`} className="eyebrow">
        Good for
      </p>
      <SituationChips labelId={`${ids}-who`} value={situations} onChange={setSituations} />

      <p id={`${ids}-depth`} className="eyebrow">
        How deep?
      </p>
      <IntensityPicker labelId={`${ids}-depth`} value={intensity} onChange={setIntensity} />

      <label htmlFor={`${ids}-topics`} className="eyebrow">
        Topics
      </label>
      <input
        id={`${ids}-topics`}
        value={topics}
        onChange={(e) => setTopics(e.target.value)}
        placeholder="e.g. childhood, travel"
        autoCapitalize="none"
      />

      <p className="small form-message" role="status">
        {message}
      </p>
      <div className="actions">
        <button className="ghost" disabled={busy} onClick={hide}>
          Hide
        </button>
        <button className="primary" disabled={busy || situations.length === 0} onClick={approve}>
          Approve
        </button>
      </div>
    </article>
  );
}

// Situations can be written as their id ("just-met") or their label ("Someone new").
const SITUATION_NAMES = new Map<string, string>(
  SITUATIONS.flatMap((s) => [
    [s.id, s.id],
    [s.label.toLowerCase(), s.id],
  ]),
);

// Rows pasted from a spreadsheet: question, situations, depth, topics (tab-separated).
// A header row is skipped. The server checks everything; this only splits the cells.
function parseRows(pasted: string): Approval[] {
  const list = (cell = '') => cell.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return pasted
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((cells) => cells[0].trim() !== '')
    .filter((cells, i) => !(i === 0 && ['question', 'text'].includes(cells[0].trim().toLowerCase())))
    .map(([text, situations, depth = '', topics]) => ({
      text,
      situations: list(situations).map((s) => SITUATION_NAMES.get(s) ?? s) as Situation[],
      intensity: depth.trim().toLowerCase() as Intensity,
      topics: list(topics),
    }));
}

function Import() {
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const rows = parseRows(pasted);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || rows.length === 0) return;
    setBusy(true);
    setMessage('');
    const res = await importQuestions(rows);
    setBusy(false);
    if (!res.ok) return setMessage(failure(res));
    const { added, skipped } = res.data;
    setMessage(`Added ${added} to the pool.${skipped ? ` Skipped ${skipped} already there.` : ''}`);
    setPasted('');
  }

  return (
    <form onSubmit={submit} className="card">
      <label htmlFor="import-rows" className="eyebrow">
        Paste rows from a spreadsheet
      </label>
      <p className="muted small">
        Four columns: question, situations, depth (light, medium or deep), topics. Separate several situations or
        topics with commas. Situations: {SITUATIONS.map((s) => s.id).join(', ')}. They go straight into the pool.
      </p>
      <textarea
        id="import-rows"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        rows={8}
        placeholder={'What made you laugh this week?\tfriends, group\tlight\thumor'}
        autoCapitalize="none"
      />
      <p className="small form-message" role="status">
        {message}
      </p>
      <button type="submit" className="primary" disabled={busy || rows.length === 0}>
        {busy ? 'Importing…' : `Import ${rows.length || ''} question${rows.length === 1 ? '' : 's'}`}
      </button>
    </form>
  );
}

function Codes() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fresh, setFresh] = useState<{ code: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getInvites().then((res) => (res.ok ? setInvites(res.data.codes) : setMessage(failure(res))));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    setCopied(false);
    const res = await createInvite(note);
    setBusy(false);
    if (!res.ok) return setMessage(failure(res));
    setFresh({ code: res.data.code, note: res.data.invite.note });
    setInvites((list) => [res.data.invite, ...(list ?? [])]);
    setNote('');
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setMessage('Couldn’t copy. Select the code and copy it by hand.');
    }
  }

  async function revoke(invite: Invite) {
    const who = invite.note ? `“${invite.note}”` : 'this person';
    if (!window.confirm(`Revoke the code for ${who}? They’ll be signed out and the code will stop working.`)) return;
    const res = await revokeInvite(invite.id);
    if (!res.ok) return setMessage(failure(res));
    const now = new Date().toISOString();
    setInvites((list) => list?.map((i) => (i.id === invite.id ? { ...i, revoked_at: now } : i)) ?? null);
  }

  return (
    <section className="stack" aria-label="Invite codes">
      <form onSubmit={create} className="card">
        <label htmlFor="invite-note" className="eyebrow">
          Who is it for? <span className="optional">Only you see this</span>
        </label>
        <input
          id="invite-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={100}
          placeholder="e.g. Sam from book club"
        />
        <p className="small form-message" role="status">
          {message}
        </p>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create code'}
        </button>
      </form>

      {fresh && (
        <div className="card new-code" role="status">
          <p className="eyebrow">New code{fresh.note ? ` for ${fresh.note}` : ''}</p>
          <p className="code">{fresh.code}</p>
          <button className="primary" onClick={() => copy(fresh.code)}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <p className="muted small">
            Send it to them privately. It can’t be shown again; if it’s lost, revoke it and make a new one.
          </p>
        </div>
      )}

      {invites === null && !message && <p className="muted small">Loading…</p>}
      {invites?.length === 0 && <p className="muted small">No codes yet.</p>}
      {invites && invites.length > 0 && (
        <ul className="invites">
          {invites.map((i) => (
            <li key={i.id} className={i.revoked_at ? 'revoked' : ''}>
              <div>
                <span>{i.note || 'No note'}</span>
                <span className="muted small">
                  {i.revoked_at ? `Revoked ${formatDate(i.revoked_at)}` : `Created ${formatDate(i.created_at)}`}
                </span>
              </div>
              {!i.revoked_at && (
                <button className="ghost small-btn" onClick={() => revoke(i)}>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
