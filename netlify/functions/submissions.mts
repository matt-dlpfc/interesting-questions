import { randomUUID } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { currentMember, type Member } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';
import { INTENSITIES, SITUATIONS } from '../lib/taxonomy.ts';

const MAX_PENDING = 20;
const MAX_TAGS = 5;

// A member's own suggestions (GET) and suggesting a new one (POST). See D4.
export default async (req: Request) => {
  const member = await currentMember(req);
  if (!member) return error(401, 'Not signed in');

  if (req.method === 'GET') return mine(member);
  if (req.method === 'POST') return submit(member, req);
  return error(405, 'Method not allowed');
};

// Pending and approved only: rejected ones quietly disappear.
async function mine(member: Member) {
  const db = getDatabase();
  const submissions = await db.sql<{ id: string; text: string; status: string; created_at: string }>`
    SELECT id, text, status, created_at
    FROM questions
    WHERE submitted_by = ${member.id} AND status IN ('pending', 'approved')
    ORDER BY created_at DESC
  `;
  return json({ submissions });
}

async function submit(member: Member, req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  if (text.length < 10 || text.length > 300) return error(400, 'A question should be 10–300 characters');

  const situations = Array.isArray(body?.situations) ? [...new Set(body.situations)] : [];
  if (situations.length === 0 || !situations.every((s) => SITUATIONS.includes(s as string))) {
    return error(400, 'Pick at least one situation');
  }

  const intensity = body?.intensity;
  if (typeof intensity !== 'string' || !INTENSITIES.includes(intensity)) return error(400, 'Pick how deep it is');

  // Suggested topics are only a hint: the admin sets the final ones at approval.
  const tags = (Array.isArray(body?.suggestedTags) ? body.suggestedTags : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim())
    .filter((t) => t.length > 0 && t.length <= 24);
  const suggestedTags = [...new Set(tags)].slice(0, MAX_TAGS);

  const db = getDatabase();
  const [{ pending }] = await db.sql<{ pending: number }>`
    SELECT COUNT(*)::int AS pending FROM questions WHERE submitted_by = ${member.id} AND status = 'pending'
  `;
  if (pending >= MAX_PENDING) return error(429, 'You have a lot waiting for review already. Try again later.');

  const [created] = await db.sql<{ id: string; text: string; status: string; created_at: string }>`
    INSERT INTO questions (id, text, situations, intensity, status, submitted_by, suggested_tags)
    VALUES (${`m-${randomUUID()}`}, ${text}, ${situations}::text[], ${intensity}, 'pending', ${member.id}, ${suggestedTags}::text[])
    RETURNING id, text, status, created_at
  `;
  return json({ submission: created }, { status: 201 });
}

export const config: Config = { path: '/api/submissions' };
