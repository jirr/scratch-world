export const NOISE_SIZE = 256;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit de valeur sur deux octaves, tuilable (grille bouclée), octets 0..255. */
export function generateNoise(size = NOISE_SIZE, seed = 1): Uint8Array {
  const rand = mulberry32(seed);
  const octave = (cells: number) => {
    const grid = Float32Array.from({ length: cells * cells }, rand);
    const at = (x: number, y: number) => grid[(y % cells) * cells + (x % cells)] as number;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    return (px: number, py: number) => {
      const fx = (px / size) * cells;
      const fy = (py / size) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = smooth(fx - x0);
      const ty = smooth(fy - y0);
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      return top * (1 - ty) + bottom * ty;
    };
  };
  const coarse = octave(16);
  const fine = octave(64);
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = Math.round((coarse(x, y) * 0.65 + fine(x, y) * 0.35) * 255);
    }
  }
  return data;
}
