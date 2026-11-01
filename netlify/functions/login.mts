import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { hashCode, isAdminCode, sessionCookie, type Member } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';

const WINDOW = '15 minutes';
const DELAY_PER_FAILURE_MS = 400;
const MAX_DELAY_MS = 5000;

// Exchanges an invite code for the "remember this device" cookie.
export default async (req: Request) => {
  if (req.method !== 'POST') return error(405, 'Method not allowed');

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code : '';
  if (code.length === 0 || code.length > 100) return error(400, 'Enter a code');

  const db = getDatabase();

  // Soft slowdown: every recent failure (from anyone) makes the next check a little slower.
  const [{ failures }] = await db.sql<{ failures: number }>`
    SELECT COUNT(*)::int AS failures FROM login_failures WHERE at > NOW() - ${WINDOW}::interval
  `;
  if (failures > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(failures * DELAY_PER_FAILURE_MS, MAX_DELAY_MS)));
  }

  const member = isAdminCode(code) ? await adminMember() : await memberForCode(hashCode(code));
  if (!member) {
    await db.sql`INSERT INTO login_failures DEFAULT VALUES`;
    await db.sql`DELETE FROM login_failures WHERE at < NOW() - INTERVAL '1 day'`;
    return error(401, 'That code didn’t work');
  }

  return json({ isAdmin: member.isAdmin }, { headers: { 'Set-Cookie': sessionCookie(member) } });
};

async function adminMember(): Promise<Member> {
  const db = getDatabase();
  await db.sql`INSERT INTO members (is_admin) VALUES (TRUE) ON CONFLICT (is_admin) WHERE is_admin DO NOTHING`;
  const [row] = await db.sql<{ id: string }>`SELECT id FROM members WHERE is_admin`;
  return { id: row.id, isAdmin: true };
}

async function memberForCode(codeHash: string): Promise<Member | null> {
  const db = getDatabase();
  const [row] = await db.sql<{ id: string; is_admin: boolean }>`
    SELECT m.id, m.is_admin
    FROM invite_codes c JOIN members m ON m.id = c.member_id
    WHERE c.code_hash = ${codeHash} AND c.revoked_at IS NULL
  `;
  return row ? { id: row.id, isAdmin: row.is_admin } : null;
}

export const config: Config = { path: '/api/login' };
