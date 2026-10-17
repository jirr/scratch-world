import type { Stats } from '../domain/stats';
import type { ScratchDb } from './db';

/** Statistiques en cache ; celles d'avant l'ajout des régions et départements sont complétées à vide. */
export async function getCachedStats(db: ScratchDb): Promise<Stats | null> {
  const row = await db.meta.get('stats');
  if (!row) return null;
  const stats = row.value as Partial<Stats> & Omit<Stats, 'regions' | 'departments'>;
  return { ...stats, regions: stats.regions ?? [], departments: stats.departments ?? [] };
}

export async function saveStats(db: ScratchDb, stats: Stats): Promise<void> {
  await db.meta.put({ key: 'stats', value: stats });
}
