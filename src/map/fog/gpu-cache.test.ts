import { describe, expect, it } from 'vitest';
import { BucketCache, type CacheEntry } from './gpu-cache';

const entry = (key: string, bytes: number, version = 1): CacheEntry => ({
  key,
  version,
  instances: { byteLength: bytes },
  stale: false,
});

describe('BucketCache', () => {
  it('évince les plus anciennes entrées au-delà du plafond', () => {
    const cache = new BucketCache(100);
    cache.set(entry('a', 60));
    cache.set(entry('b', 60));
    expect(cache.evict(new Set()).map((e) => e.key)).toEqual(['a']);
    expect(cache.bytes).toBe(60);
  });

  it('ne touche jamais aux entrées épinglées, même au-delà du plafond', () => {
    const cache = new BucketCache(50);
    cache.set(entry('a', 60));
    cache.set(entry('b', 60));
    expect(cache.evict(new Set(['a', 'b']))).toEqual([]);
    expect(cache.size).toBe(2);
  });

  it('une lecture rend l’entrée plus récente', () => {
    const cache = new BucketCache(100);
    cache.set(entry('a', 60));
    cache.set(entry('b', 60));
    cache.get('a');
    expect(cache.evict(new Set()).map((e) => e.key)).toEqual(['b']);
  });

  it('remplacer une entrée renvoie l’ancienne et corrige les octets', () => {
    const cache = new BucketCache(1000);
    const old = entry('a', 40, 1);
    cache.set(old);
    expect(cache.set(entry('a', 10, 2))).toBe(old);
    expect(cache.bytes).toBe(10);
  });

  it('les entrées périmées ne sont plus déclarées détenues', () => {
    const cache = new BucketCache(1000);
    cache.set(entry('a', 10, 3));
    cache.set(entry('b', 10, 4));
    cache.markStale(['a']);
    expect(cache.versions()).toEqual({ b: 4 });
  });
});
