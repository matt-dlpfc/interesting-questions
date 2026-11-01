// Invite codes and the "remember this device" cookie (D1, D17).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '@netlify/database';

const COOKIE = 'iq_session';
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface Member {
  id: string;
  isAdmin: boolean;
}

function secret(name: 'ADMIN_CODE' | 'CODE_PEPPER' | 'SESSION_SECRET'): string {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function hmac(key: string, value: string): string {
  return createHmac('sha256', key).update(value).digest('base64url');
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// "Tiger Ferry 42", "tiger_ferry-42 " and "tiger-ferry-42" are the same code.
export function normalizeCode(code: string): string {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Codes are only ever stored as this keyed hash.
export function hashCode(code: string): string {
  return hmac(secret('CODE_PEPPER'), normalizeCode(code));
}

export function isAdminCode(code: string): boolean {
  return sameString(hashCode(code), hashCode(secret('ADMIN_CODE')));
}

// The admin's signature also covers ADMIN_CODE, so changing that code signs the admin out everywhere.
function signature(member: Member): string {
  const subject = member.isAdmin ? `${member.id}|admin|${secret('ADMIN_CODE')}` : member.id;
  return hmac(secret('SESSION_SECRET'), subject);
}

export function sessionCookie(member: Member): string {
  const value = `${member.id}.${signature(member)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ONE_YEAR}`;
}

export function clearedCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(req: Request): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return undefined;
}

// The member this device is signed in as, or null. A member whose code has been revoked is signed out.
export async function currentMember(req: Request): Promise<Member | null> {
  const [id, sig] = readCookie(req)?.split('.') ?? [];
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;

  const db = getDatabase();
  const [row] = await db.sql<{ id: string; is_admin: boolean }>`
    SELECT m.id, m.is_admin
    FROM members m
    WHERE m.id = ${id}
      AND (m.is_admin OR EXISTS (
        SELECT 1 FROM invite_codes c WHERE c.member_id = m.id AND c.revoked_at IS NULL
      ))
  `;
  if (!row) return null;

  const member = { id: row.id, isAdmin: row.is_admin };
  return sameString(sig, signature(member)) ? member : null;
}
