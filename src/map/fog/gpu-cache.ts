export interface CacheEntry {
  key: string;
  version: number;
  instances: { byteLength: number };
  /** Invalidé par le worker : à redemander, mais encore dessinable en attendant. */
  stale: boolean;
}

/** Cache LRU borné en octets ; les entrées épinglées (en cours de dessin) ne sont jamais évincées. */
export class BucketCache<T extends CacheEntry> {
  #entries = new Map<string, T>();
  #bytes = 0;

  constructor(private readonly maxBytes: number) {}

  get bytes(): number {
    return this.#bytes;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: string): T | undefined {
    const entry = this.#entries.get(key);
    if (entry) {
      this.#entries.delete(key);
      this.#entries.set(key, entry);
    }
    return entry;
  }

  /** Insère ; retourne l'entrée remplacée (à libérer par l'appelant une fois le remplacement visible). */
  set(entry: T): T | undefined {
    const replaced = this.#entries.get(entry.key);
    if (replaced) this.#bytes -= replaced.instances.byteLength;
    this.#entries.delete(entry.key);
    this.#entries.set(entry.key, entry);
    this.#bytes += entry.instances.byteLength;
    return replaced;
  }

  markStale(keys: Iterable<string>): void {
    for (const key of keys) {
      const entry = this.#entries.get(key);
      if (entry) entry.stale = true;
    }
  }

  /** Versions des entrées à jour : ce que l'appelant peut déclarer détenir. */
  versions(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.#entries.values()) if (!entry.stale) result[entry.key] = entry.version;
    return result;
  }

  /** Évince les plus anciennes entrées non épinglées jusqu'à repasser sous le plafond. */
  evict(pinned: ReadonlySet<string>): T[] {
    const evicted: T[] = [];
    for (const [key, entry] of this.#entries) {
      if (this.#bytes <= this.maxBytes) break;
      if (pinned.has(key)) continue;
      this.#entries.delete(key);
      this.#bytes -= entry.instances.byteLength;
      evicted.push(entry);
    }
    return evicted;
  }

  values(): IterableIterator<T> {
    return this.#entries.values();
  }
}
