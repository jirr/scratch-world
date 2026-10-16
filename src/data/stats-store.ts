import type { Stats } from '../domain/stats';
import type { ScratchDb } from './db';

export async function getCachedStats(db: ScratchDb): Promise<Stats | null> {
  const row = await db.meta.get('stats');
  return row ? (row.value as Stats) : null;
}

export async function saveStats(db: ScratchDb, stats: Stats): Promise<void> {
  await db.meta.put({ key: 'stats', value: stats });
}
