import { describe, expect, it } from 'vitest';
import { streamTopLevelArrayItems, type StreamItem } from './json-stream';

function streamOf(bytes: Uint8Array, splits: number[]): ReadableStream<Uint8Array> {
  const cuts = [0, ...splits, bytes.length];
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < cuts.length - 1; i++) {
        controller.enqueue(bytes.slice(cuts[i], cuts[i + 1]));
      }
      controller.close();
    },
  });
}

async function run(text: string, splits: number[], keys?: string[]): Promise<StreamItem[]> {
  const out: StreamItem[] = [];
  const bytes = new TextEncoder().encode(text);
  for await (const item of streamTopLevelArrayItems(streamOf(bytes, splits), undefined, keys)) {
    out.push(item);
  }
  return out;
}

const OBJECT_DOC = JSON.stringify({
  version: 'v{1}',
  locations: [
    { s: 'accolades {} et crochets [] "guillemets" \\ antislash', n: 1 },
    { s: 'é à ü 日本語 😀', n: 2, nested: { a: [1, 2, { b: '}' }] } },
    { s: '', n: 3 },
  ],
  other: [{ ignored: true }],
  tail: 'x',
});
const ARRAY_DOC = JSON.stringify([{ a: 1 }, { b: ['x]', '[y'] }, { c: { d: '"' } }], null, 2);

describe('streamTopLevelArrayItems', () => {
  it('lit les éléments d’un tableau de niveau 1 découpé à chaque position d’octet', async () => {
    const length = new TextEncoder().encode(OBJECT_DOC).length;
    const expected = JSON.parse(OBJECT_DOC) as { locations: unknown[]; other: unknown[] };
    for (let cut = 0; cut <= length; cut++) {
      const items = await run(OBJECT_DOC, [cut]);
      expect(items.filter((i) => i.key === 'locations').map((i) => i.item)).toEqual(
        expected.locations,
      );
      expect(items.filter((i) => i.key === 'other').map((i) => i.item)).toEqual(expected.other);
    }
  });

  it('lit un tableau en racine (clé null) découpé à chaque position d’octet', async () => {
    const length = new TextEncoder().encode(ARRAY_DOC).length;
    const expected = JSON.parse(ARRAY_DOC) as unknown[];
    for (let cut = 0; cut <= length; cut++) {
      const items = await run(ARRAY_DOC, [cut]);
      expect(items.map((i) => i.item)).toEqual(expected);
      expect(items.every((i) => i.key === null)).toBe(true);
    }
  });

  it('survit à un découpage en tout petits morceaux', async () => {
    const length = new TextEncoder().encode(OBJECT_DOC).length;
    const everyByte = Array.from({ length: length - 1 }, (_, i) => i + 1);
    const items = await run(OBJECT_DOC, everyByte);
    expect(items.filter((i) => i.key === 'locations')).toHaveLength(3);
  });

  it('ignore les tableaux non demandés', async () => {
    const items = await run(OBJECT_DOC, [], ['locations']);
    expect(new Set(items.map((i) => i.key))).toEqual(new Set(['locations']));
  });

  it('gère les littéraux dans un tableau et un document vide', async () => {
    const items = await run('{"v":[1, "deux", null, true, 4.5e1]}', [3]);
    expect(items.map((i) => i.item)).toEqual([1, 'deux', null, true, 45]);
    expect(await run('{}', [])).toEqual([]);
    expect(await run('[]', [])).toEqual([]);
  });

  it('rapporte la progression en octets', async () => {
    const bytes = new TextEncoder().encode(ARRAY_DOC);
    const seen: number[] = [];
    for await (const _ of streamTopLevelArrayItems(streamOf(bytes, [10, 20]), (n) =>
      seen.push(n),
    )) {
      void _;
    }
    expect(seen.at(-1)).toBe(bytes.length);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});
