import type { Config } from '@netlify/functions';
import { currentMember } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';

// Who this device is signed in as. 401 sends the app back to the code screen.
export default async (req: Request) => {
  if (req.method !== 'GET') return error(405, 'Method not allowed');

  const member = await currentMember(req);
  if (!member) return error(401, 'Not signed in');
  return json({ isAdmin: member.isAdmin });
};

export const config: Config = { path: '/api/me' };
