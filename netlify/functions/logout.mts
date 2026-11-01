import type { Config } from '@netlify/functions';
import { clearedCookie } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';

// "Forget this device". The code itself keeps working.
export default async (req: Request) => {
  if (req.method !== 'POST') return error(405, 'Method not allowed');
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookie() } });
};

export const config: Config = { path: '/api/logout' };
