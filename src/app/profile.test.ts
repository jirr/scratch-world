import { describe, expect, it } from 'vitest';
import { PSEUDO_MAX, validatePseudo } from './profile.svelte';

describe('validatePseudo', () => {
  it('nettoie les espaces et accepte une longueur raisonnable', () => {
    expect(validatePseudo('  Léa   M  ')).toBe('Léa M');
    expect(validatePseudo('ab')).toBe('ab');
    expect(validatePseudo('x'.repeat(PSEUDO_MAX))).toHaveLength(PSEUDO_MAX);
  });

  it('refuse trop court, trop long ou vide', () => {
    expect(validatePseudo('')).toBeNull();
    expect(validatePseudo('  a ')).toBeNull();
    expect(validatePseudo('x'.repeat(PSEUDO_MAX + 1))).toBeNull();
  });
});
