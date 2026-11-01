import { randomUUID } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { currentMember, type Member } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';
import { cleanTopics, parseQuestionFields } from '../lib/taxonomy.ts';

const MAX_PENDING = 20;

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

  const fields = parseQuestionFields(body);
  if (typeof fields === 'string') return error(400, fields);
  const { text, situations, intensity } = fields;

  // Suggested topics are only a hint: the admin sets the final ones at approval.
  const suggestedTags = cleanTopics(body?.suggestedTags);

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
