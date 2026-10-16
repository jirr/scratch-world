export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Langue de repli quand aucune langue préférée du système n'est disponible. */
export const FALLBACK_LOCALE: Locale = 'en';

/** Première langue préférée (`navigator.languages`, ex. `fr-CA`) disponible, sinon l'anglais. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.split('-')[0]?.toLowerCase() ?? '';
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return FALLBACK_LOCALE;
}
