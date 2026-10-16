export type NamedStyle = 'liberty' | 'bright' | 'positron' | 'dark' | 'fiord';

const BASE = 'https://tiles.openfreemap.org/styles';

export function styleUrl(name: NamedStyle): string {
  return `${BASE}/${name}`;
}

/** `auto` : style sombre en thème sombre, clair sinon. */
export function autoStyleUrl(prefersDark: boolean): string {
  return styleUrl(prefersDark ? 'dark' : 'liberty');
}
