import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { error, json } from '../lib/http.ts';

interface QuestionRow {
  id: string;
  text: string;
  topics: string[];
  situations: string[];
  intensity: string;
}

// The approved pool. Unauthenticated for now: until invite codes land it only holds the public starter set.
export default async (req: Request) => {
  if (req.method !== 'GET') return error(405, 'Method not allowed');

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
