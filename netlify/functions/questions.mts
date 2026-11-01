import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { currentMember } from '../lib/auth.ts';
import { error, json } from '../lib/http.ts';

interface QuestionRow {
  id: string;
  text: string;
  topics: string[];
  situations: string[];
  intensity: string;
}

// The approved pool, for members only.
export default async (req: Request) => {
  if (req.method !== 'GET') return error(405, 'Method not allowed');
  if (!(await currentMember(req))) return error(401, 'Not signed in');

  const db = getDatabase();
  const questions = await db.sql<QuestionRow>`
    SELECT id, text, topics, situations, intensity
    FROM questions
    WHERE status = 'approved'
    ORDER BY id
  `;
  return json({ questions });
};

export const config: Config = { path: '/api/questions' };
