import { getDatabase } from '@netlify/database';
import type { Config, Context } from '@netlify/functions';
import { currentMember } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';
import { cleanTopics, parseQuestionFields } from '../lib/taxonomy.ts';

// The approval queue (D4): list pending suggestions, then approve (with edits) or hide each one.
export default async (req: Request, context: Context) => {
  const member = await currentMember(req);
  if (!member?.isAdmin) return error(403, 'Admins only');

  const id = context.params.id;
  if (req.method === 'GET' && !id) return queue();
  if (req.method === 'POST' && id) return review(id, req);
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

export const config: Config = { path: ['/api/admin/questions', '/api/admin/questions/:id'] };
