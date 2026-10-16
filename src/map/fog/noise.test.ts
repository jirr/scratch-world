import { describe, expect, it } from 'vitest';
import { generateNoise } from './noise';

describe('generateNoise', () => {
  it('est déterministe et couvre une plage utile', () => {
    const a = generateNoise(64, 1);
    expect(a).toEqual(generateNoise(64, 1));
    expect(a).not.toEqual(generateNoise(64, 2));
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(80);
  });

  it('est tuilable : la jonction entre bords opposés est aussi lisse que l’intérieur', () => {
    const size = 64;
    const n = generateNoise(size, 1);
    let seam = 0;
    let inner = 0;
    for (let y = 0; y < size; y++) {
      seam += Math.abs((n[y * size] as number) - (n[y * size + size - 1] as number));
      inner += Math.abs((n[y * size + 31] as number) - (n[y * size + 32] as number));
    }
    expect(seam / size).toBeLessThan((inner / size) * 3 + 2);
  });
});
