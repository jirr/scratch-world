import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { ScratchDb } from './db';
import * as v1 from './schema/v1';

/** Un instantané par version de schéma, de la plus ancienne à la plus récente. */
const snapshots = [{ version: 1, ...v1 }];
const CURRENT_VERSION = snapshots.length;

const opened: Dexie[] = [];
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close();
    await d.delete();
  }
});

function uniqueName() {
  return `migration-${Math.random()}`;
}

describe('migrations Dexie', () => {
  it.each(snapshots.filter((s) => s.version < CURRENT_VERSION))(
    'conserve les données de la v$version octet pour octet',
    async (snapshot) => {
      const name = uniqueName();
      const old = new Dexie(name);
      for (const s of snapshots.filter((x) => x.version <= snapshot.version)) {
        old.version(s.version).stores({ ...s.stores });
      }
      await old.open();
      await snapshot.seed(old);
      const before = await old.table('chunks').toArray();
      const settingsBefore = await old.table('settings').toArray();
      old.close();

      const current = new ScratchDb(name);
      opened.push(current);
      await current.open();
      const after = await current.chunks.toArray();
      expect(after).toHaveLength(before.length);
      for (const row of before) {
        const migrated = after.find((r) => r.key === row.key);
        expect(migrated?.pos).toEqual(row.pos);
        expect(migrated?.areaKm2).toBe(row.areaKm2);
      }
      expect(await current.imports.count()).toBe(1);
      expect(await current.settings.toArray()).toEqual(settingsBefore);
    },
  );

  it('le schéma courant correspond au dernier instantané figé', async () => {
    const current = new ScratchDb(uniqueName());
    opened.push(current);
    await current.open();
    const latest = snapshots[snapshots.length - 1];
    expect(current.verno).toBe(latest?.version);
    const declared = Object.fromEntries(
      current.tables.map((t) => [
        t.name,
        [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', '),
      ]),
    );
    expect(declared).toEqual(latest?.stores);
  });

  it('un instantané rouvre ses propres données avec la base courante (v1 → v1)', async () => {
    const name = uniqueName();
    const first = new ScratchDb(name);
    opened.push(first);
    await first.open();
    await v1.seed(first);
    first.close();

    const again = new ScratchDb(name);
    opened.push(again);
    expect(await again.chunks.count()).toBe(3);
  });
});
