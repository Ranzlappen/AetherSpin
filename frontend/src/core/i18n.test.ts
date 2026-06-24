import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { t, tn, locale, localeTag, setLocale, resolveLocale } from './i18n';

describe('i18n', () => {
  beforeEach(() => locale.set('en'));

  describe('resolveLocale', () => {
    it('maps supported language hints to locale codes', () => {
      expect(resolveLocale('de')).toBe('de');
      expect(resolveLocale('de-DE')).toBe('de');
      expect(resolveLocale('EN_us')).toBe('en');
    });
    it('falls back to English for unsupported/empty hints', () => {
      expect(resolveLocale('fr')).toBe('en');
      expect(resolveLocale('')).toBe('en');
      expect(resolveLocale(null)).toBe('en');
      expect(resolveLocale(undefined)).toBe('en');
    });
  });

  it('setLocale updates the active locale and BCP-47 tag', () => {
    setLocale('de-DE');
    expect(get(locale)).toBe('de');
    expect(get(localeTag)).toBe('de-DE');
  });

  it('translates using the active locale', () => {
    setLocale('de');
    expect(get(t)('hud.balance')).toBe('Guthaben');
  });

  it('falls back to English when a key is missing in the locale', () => {
    setLocale('de');
    // 'hud.demoBadge' is intentionally not translated in de.ts.
    expect(get(t)('hud.demoBadge', { fps: 60 })).toBe(get(t)('hud.demoBadge', { fps: 60 }));
    locale.set('en');
    const english = get(t)('hud.demoBadge', { fps: 60 });
    setLocale('de');
    expect(get(t)('hud.demoBadge', { fps: 60 })).toBe(english);
  });

  it('interpolates named placeholders', () => {
    expect(tn('a11y.win', { amount: '$5.00' })).toBe('You won $5.00.');
    setLocale('de');
    expect(tn('a11y.win', { amount: '5,00 €' })).toBe('Sie haben 5,00 € gewonnen.');
  });

  it('leaves unknown placeholders intact', () => {
    expect(tn('a11y.win')).toBe('You won {amount}.');
  });
});
