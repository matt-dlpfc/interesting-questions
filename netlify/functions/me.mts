import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { currentMember } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';

// Who this device is signed in as. 401 sends the app back to the code screen.
// The admin also gets the number of suggestions waiting for review (D4's "N pending" badge).
export default async (req: Request) => {
  if (req.method !== 'GET') return error(405, 'Method not allowed');

  const member = await currentMember(req);
  if (!member) return error(401, 'Not signed in');
  if (!member.isAdmin) return json({ isAdmin: false, pendingCount: 0 });

  const db = getDatabase();
  const [{ pending }] = await db.sql<{ pending: number }>`
    SELECT COUNT(*)::int AS pending FROM questions WHERE status = 'pending'
  `;
  return json({ isAdmin: true, pendingCount: pending });
};

export const config: Config = { path: '/api/me' };
