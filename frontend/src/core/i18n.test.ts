import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { t, tn, locale, localeTag, setLocale, resolveLocale, hasKey } from './i18n';
import { en } from '../locales/en';
import { de } from '../locales/de';
import { es } from '../locales/es';
import { pt } from '../locales/pt';

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

  it('setLocale reflects the resolved locale onto <html lang>', () => {
    setLocale('de');
    expect(document.documentElement.lang).toBe('de-DE');
    setLocale('fr'); // unsupported → English
    expect(document.documentElement.lang).toBe('en-US');
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

  it('hasKey narrows arbitrary strings to defined translation keys', () => {
    expect(hasKey('paytable.desc.novaforged')).toBe(true);
    expect(hasKey('paytable.desc.someUnknownGame')).toBe(false);
  });

  describe('player-facing key completeness', () => {
    // Locales are Partial by design, but the player-facing feature strings
    // (turbo, skip, win tiers, autoplay limits, paytable/feature copy) must be
    // fully translated in every shipped locale — English fallback there would
    // read as a localization bug to a reviewer.
    const families = ['turbo.', 'win.', 'spin.', 'autoplay.', 'paytable.', 'volatility.'];
    const required = (Object.keys(en) as Array<keyof typeof en>).filter((k) =>
      families.some((f) => k.startsWith(f))
    );

    it.each([
      ['de', de],
      ['es', es],
      ['pt', pt],
    ] as const)('%s translates every player-facing feature key', (_name, dict) => {
      const missing = required.filter((k) => !(k in dict));
      expect(missing).toEqual([]);
    });
  });
});
