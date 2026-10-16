const PSEUDO_KEY = 'sw:pseudo';

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 24;

/** Pseudo choisi sur la page d'accueil ; stocké uniquement sur cet appareil (aucun serveur). */
export const profile = $state({
  pseudo: (typeof localStorage === 'undefined' ? null : localStorage.getItem(PSEUDO_KEY)) ?? '',
});

/** Retourne le pseudo nettoyé s'il est valide, sinon `null`. */
export function validatePseudo(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, ' ');
  return value.length >= PSEUDO_MIN && value.length <= PSEUDO_MAX ? value : null;
}

export function setPseudo(value: string): boolean {
  const pseudo = validatePseudo(value);
  if (pseudo === null) return false;
  profile.pseudo = pseudo;
  localStorage.setItem(PSEUDO_KEY, pseudo);
  return true;
}
