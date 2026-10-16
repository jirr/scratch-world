import { TILE_SIZE_PX } from '../../domain/config';

/** Vue Mercator : centre (unités 0..1), zoom et taille du canvas en px CSS. Nord en haut, sans pitch. */
export interface ViewState {
  cx: number;
  cy: number;
  zoom: number;
  width: number;
  height: number;
}

const worldPx = (v: ViewState) => TILE_SIZE_PX * 2 ** v.zoom;

/** Clip-space par unité Mercator (calculé en Float64 : exact même à zoom 20). */
export function clipScale(v: ViewState): [number, number] {
  const s = worldPx(v);
  return [(2 * s) / v.width, (-2 * s) / v.height];
}

/** Position clip-space de l'origine `(ox, oy)` d'un bucket (copie du monde incluse dans `ox`). */
export function clipOffset(v: ViewState, ox: number, oy: number): [number, number] {
  const [sx, sy] = clipScale(v);
  return [(ox - v.cx) * sx, (oy - v.cy) * sy];
}

/** Indices des copies du monde (x Mercator + k) qui intersectent la vue. */
export function worldCopies(v: ViewState): number[] {
  const half = v.width / 2 / worldPx(v);
  const first = Math.floor(v.cx - half);
  const last = Math.floor(v.cx + half);
  const copies: number[] = [];
  for (let k = first; k <= last; k++) copies.push(k);
  return copies;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Décalage de la texture de bruit pour que le grain suive le panoramique (px CSS, modulo `size`). */
export function noiseOffset(v: ViewState, size: number): [number, number] {
  const s = worldPx(v);
  return [mod(v.cx * s - v.width / 2, size), mod(v.cy * s + v.height / 2, size)];
}
