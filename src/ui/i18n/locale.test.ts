import { describe, expect, it } from 'vitest';
import { detectLocale } from './locale';

describe('detectLocale', () => {
  it('reconnaît les variantes régionales', () => {
    expect(detectLocale(['fr-CA'])).toBe('fr');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['FR'])).toBe('fr');
  });

  it('prend la première langue disponible dans l’ordre de préférence', () => {
    expect(detectLocale(['de-DE', 'fr-FR', 'en-US'])).toBe('fr');
    expect(detectLocale(['en-US', 'fr-FR'])).toBe('en');
  });

  it('se replie sur l’anglais sans langue disponible', () => {
    expect(detectLocale(['de-DE', 'ja'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});
