import { settings } from '../state/settings.svelte';
import { en } from './en';
import { fr, type Messages } from './fr';
import { detectLocale, type Locale } from './locale';

const DICTIONARIES: Record<Locale, Messages> = { fr, en };

const systemLocale = detectLocale(navigator.languages);

/** Langue affichée : réglage explicite, sinon celle du système. */
const locale = $derived(settings.language === 'system' ? systemLocale : settings.language);

export const i18n = {
  get locale(): Locale {
    return locale;
  },
};

/**
 * Textes de la langue courante. Chaque lecture (`S.close`) passe par `locale` : les composants
 * se mettent à jour quand la langue change.
 */
export const S: Messages = new Proxy({} as Messages, {
  get: (_target, key) => DICTIONARIES[locale][key as keyof Messages],
});
