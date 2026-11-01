import { randomUUID } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import type { Config, Context } from '@netlify/functions';
import { currentMember } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';
import { cleanTopics, parseQuestionFields } from '../lib/taxonomy.ts';

// The approval queue (D4): list pending suggestions, then approve (with edits) or hide each one.
// Also a one-off bulk import of the admin's own questions, which go straight in as approved.
export default async (req: Request, context: Context) => {
  const member = await currentMember(req);
  if (!member?.isAdmin) return error(403, 'Admins only');

  const id = context.params.id;
  if (req.method === 'GET' && !id) return queue();
  if (req.method === 'POST' && id) return review(id, req);
  if (req.method === 'POST') return bulkImport(req);
  return error(405, 'Method not allowed');
};

// Oldest first, so nothing waits forever.
async function queue() {
  const db = getDatabase();
  const questions = await db.sql`
    SELECT id, text, situations, intensity, suggested_tags, created_at
    FROM questions
    WHERE status = 'pending'
    ORDER BY created_at
  `;
  return json({ questions });
}

async function review(id: string, req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const db = getDatabase();

  if (body?.action === 'hide') {
    // Hidden, never deleted, so it can be undone (D4).
    const updated = await db.sql`
      UPDATE questions SET status = 'hidden', reviewed_at = NOW() WHERE id = ${id} AND status = 'pending' RETURNING id
    `;
    return updated.length ? json({ ok: true }) : error(404, 'Not in the queue');
  }

  if (body?.action === 'approve') {
    const fields = parseQuestionFields(body);
    if (typeof fields === 'string') return error(400, fields);
    const topics = cleanTopics(body.topics);

    const updated = await db.sql`
      UPDATE questions
      SET text = ${fields.text}, situations = ${fields.situations}::text[], intensity = ${fields.intensity},
          topics = ${topics}::text[], status = 'approved', reviewed_at = NOW()
      WHERE id = ${id} AND status = 'pending'
      RETURNING id
    `;
    return updated.length ? json({ ok: true }) : error(404, 'Not in the queue');
  }

  return error(400, 'Unknown action');
}

const MAX_IMPORT = 200;

// All or nothing: one bad row and nothing is added, so a fixed batch can simply be pasted again.
// Questions already in the pool (same text, ignoring case) are skipped.
async function bulkImport(req: Request) {
  const body = (await req.json().catch(() => null)) as { questions?: unknown } | null;
  const rows = Array.isArray(body?.questions) ? (body.questions as Record<string, unknown>[]) : [];
  if (rows.length === 0) return error(400, 'Nothing to import');
  if (rows.length > MAX_IMPORT) return error(400, `At most ${MAX_IMPORT} questions at a time`);

  const parsed = [];
  for (const [i, row] of rows.entries()) {
    const fields = parseQuestionFields(row);
    if (typeof fields === 'string') return error(400, `Row ${i + 1}: ${fields}`);
    parsed.push({ ...fields, topics: cleanTopics(row.topics) });
  }

  const db = getDatabase();
  const existing = await db.sql<{ text: string }>`SELECT text FROM questions`;
  const seen = new Set(existing.map((q) => q.text.toLowerCase()));
  const fresh = parsed.filter((q) => {
    const key = q.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const q of fresh) {
    await db.sql`
      INSERT INTO questions (id, text, topics, situations, intensity, status, reviewed_at)
      VALUES (${`a-${randomUUID()}`}, ${q.text}, ${q.topics}::text[], ${q.situations}::text[], ${q.intensity}, 'approved', NOW())
    `;
  }
  return json({ added: fresh.length, skipped: parsed.length - fresh.length });
}

export const config: Config = { path: ['/api/admin/questions', '/api/admin/questions/:id'] };
