import type Dexie from 'dexie';
import { seed as seedV1, stores as storesV1 } from './v1';

/** Copie figée du schéma complet après `version(2)` (ajout de `regionCache`). */
export const stores = { ...storesV1, regionCache: 'cell' } as const;

export async function seed(db: Dexie): Promise<void> {
  await seedV1(db);
  await db.table('regionCache').bulkPut([
    { cell: '871fb4662ffffff', country: 'FR' },
    { cell: '872830828ffffff', country: '' },
  ]);
}
