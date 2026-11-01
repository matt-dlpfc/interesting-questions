import { getDatabase } from '@netlify/database';
import type { Config, Context } from '@netlify/functions';
import { currentMember, hashCode } from '../lib/auth.ts';
import { generateCode } from '../lib/codes.ts';
import { error, json } from '../lib/http.ts';

// Invite codes (D1, D3): list them, create one per person, revoke one at a time.
export default async (req: Request, context: Context) => {
  const member = await currentMember(req);
  if (!member?.isAdmin) return error(403, 'Admins only');

  const id = context.params.id;
  if (req.method === 'GET' && !id) return list();
  if (req.method === 'POST' && !id) return create(req);
  if (req.method === 'POST' && id) return revoke(id);
  return error(405, 'Method not allowed');
};

// The codes themselves can't be listed: only their hashes are stored.
async function list() {
  const db = getDatabase();
  const codes = await db.sql`
    SELECT id, note, created_at, revoked_at FROM invite_codes ORDER BY created_at DESC
  `;
  return json({ codes });
}

// Every code gets its own new member. The plain code is returned once and never stored.
async function create(req: Request) {
  const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 100) : '';

  const db = getDatabase();
  // A clash between random codes is vanishingly rare, but check anyway.
  let code = generateCode();
  for (let attempt = 0; attempt < 3; attempt++) {
    const [clash] = await db.sql`SELECT 1 FROM invite_codes WHERE code_hash = ${hashCode(code)}`;
    if (!clash) break;
    code = generateCode();
  }

  const [created] = await db.sql<{ id: number; note: string; created_at: string }>`
    WITH new_member AS (INSERT INTO members DEFAULT VALUES RETURNING id)
    INSERT INTO invite_codes (member_id, code_hash, note)
    SELECT id, ${hashCode(code)}, ${note} FROM new_member
    RETURNING id, note, created_at
  `;
  return json({ code, invite: { ...created, revoked_at: null } }, { status: 201 });
}

async function revoke(id: string) {
  if (!/^\d+$/.test(id)) return error(404, 'No such code');
  const db = getDatabase();
  const updated = await db.sql`
    UPDATE invite_codes SET revoked_at = NOW() WHERE id = ${Number(id)} AND revoked_at IS NULL RETURNING id
  `;
  return updated.length ? json({ ok: true }) : error(404, 'No such active code');
}

export const config: Config = { path: ['/api/admin/codes', '/api/admin/codes/:id/revoke'] };
