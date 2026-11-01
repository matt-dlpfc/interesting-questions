import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { currentMember } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';
import { SITUATIONS } from '../lib/taxonomy.ts';

const MAX_BATCH = 500;

interface IncomingRating {
  questionId: string;
  rating: number;
  situation: string;
  at: number;
}

function isRating(r: any): r is IncomingRating {
  return (
    typeof r?.questionId === 'string' &&
    r.questionId.length <= 64 &&
    Number.isInteger(r.rating) &&
    r.rating >= 1 &&
    r.rating <= 10 &&
    SITUATIONS.includes(r.situation) &&
    Number.isFinite(r.at)
  );
}

// Saves a batch of ratings from one device: one rating per member per question, the newest wins.
// Devices send ratings later when they were offline, so `at` (when it was given) decides, not arrival order.
export default async (req: Request) => {
  if (req.method !== 'PUT') return error(405, 'Method not allowed');
  const member = await currentMember(req);
  if (!member) return error(401, 'Not signed in');

  const body = (await req.json().catch(() => null)) as { ratings?: unknown } | null;
  if (!Array.isArray(body?.ratings) || body.ratings.length > MAX_BATCH) return error(400, 'Expected a list of ratings');

  // Keep the newest per question; a batch may not touch the same row twice.
  const latest = new Map<string, IncomingRating>();
  for (const r of body.ratings.filter(isRating)) {
    const at = Math.min(r.at, Date.now());
    if ((latest.get(r.questionId)?.at ?? -1) < at) latest.set(r.questionId, { ...r, at });
  }
  const rows = [...latest.values()];
  if (rows.length === 0) return json({ saved: 0 });

  // Ratings for questions that no longer exist are dropped by the join.
  const db = getDatabase();
  const saved = await db.sql`
    INSERT INTO ratings (member_id, question_id, rating, situation, updated_at)
    SELECT ${member.id}::uuid, r.question_id, r.rating, r.situation, to_timestamp(r.at / 1000.0)
    FROM unnest(
      ${rows.map((r) => r.questionId)}::text[],
      ${rows.map((r) => r.rating)}::int[],
      ${rows.map((r) => r.situation)}::text[],
      ${rows.map((r) => r.at)}::float8[]
    ) AS r(question_id, rating, situation, at)
    JOIN questions q ON q.id = r.question_id
    ON CONFLICT (member_id, question_id) DO UPDATE
      SET rating = EXCLUDED.rating, situation = EXCLUDED.situation, updated_at = EXCLUDED.updated_at
      WHERE ratings.updated_at < EXCLUDED.updated_at
    RETURNING question_id
  `;
  return json({ saved: saved.length });
};

export const config: Config = { path: '/api/ratings' };
