// Ratings are saved on the device first, then shared with the group when there's a connection.
// Everything rated after the last successful sync is sent, so ratings from before Phase 2 go up once too.

import { putRatings } from './api';
import type { Situation } from './questions';
import { load, save } from './storage';

export interface Rating {
  questionId: string;
  rating: number;
  situation: Situation;
  at: number;
}

export function addRating(rating: Rating): void {
  const all = load<Rating[]>('ratings', []);
  all.push(rating);
  save('ratings', all);
  void syncRatings();
}

let syncing = false;

export async function syncRatings(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const syncedAt = load<number>('ratingsSyncedAt', 0);
    const unsent = load<Rating[]>('ratings', []).filter((r) => r.at > syncedAt);
    if (unsent.length === 0) return;
    const res = await putRatings(unsent);
    if (res.ok) save('ratingsSyncedAt', Math.max(...unsent.map((r) => r.at)));
  } finally {
    syncing = false;
  }
}

// Called when someone forgets this device, so the next person's code doesn't pick up these ratings.
export function markRatingsSynced(): void {
  save('ratingsSyncedAt', Date.now());
}
