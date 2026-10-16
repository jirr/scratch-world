export type NamedStyle = 'liberty' | 'bright' | 'positron' | 'dark' | 'fiord';
export type StyleChoice = 'auto' | NamedStyle | 'custom';

export interface Appearance {
  style: StyleChoice;
  customStyleUrl: string;
  dark: boolean;
}

const BASE = 'https://tiles.openfreemap.org/styles';

export function styleUrl(name: NamedStyle): string {
  return `${BASE}/${name}`;
}

/** Une URL de style personnalisée doit être en https (http seulement pour localhost). */
export function isValidStyleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost');
  } catch {
    return false;
  }
}

/** `auto` : style sombre en thème sombre, clair sinon ; une URL personnalisée invalide retombe sur `auto`. */
export function resolveStyleUrl({ style, customStyleUrl, dark }: Appearance): string {
  if (style === 'custom' && isValidStyleUrl(customStyleUrl)) return customStyleUrl;
  if (style === 'auto' || style === 'custom') return styleUrl(dark ? 'dark' : 'liberty');
  return styleUrl(style);
}
