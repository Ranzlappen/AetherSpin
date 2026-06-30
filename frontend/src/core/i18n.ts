/**
 * Minimal, dependency-free internationalization for the game client.
 *
 * - `en.ts` is the canonical dictionary; it defines the legal key set.
 * - Other locales (e.g. `de.ts`) are `Partial<Translations>`; any missing key
 *   transparently falls back to English, so a half-translated locale is safe.
 * - The active locale is a Svelte store; `t` is a derived store yielding a
 *   `t(key, params)` function so templates re-render on language change.
 *
 * Resolution order at boot: explicit RGS `lang` param → `navigator.language` →
 * English. Outcomes/labels are server-driven; this only localizes UI chrome.
 */
import { derived, get, writable, type Readable } from 'svelte/store';
import { en } from '../locales/en';
import { de } from '../locales/de';
import { es } from '../locales/es';
import { pt } from '../locales/pt';

/** A valid translation key (the keys of the canonical English dictionary). */
export type TranslationKey = keyof typeof en;
/** The full key/value shape: every key maps to a (possibly translated) string. */
export type Translations = Record<TranslationKey, string>;
/** Interpolation parameters for placeholder substitution (`{name}`). */
export type TranslationParams = Record<string, string | number>;

const DICTS = { en, de, es, pt } as const;
/** Supported locale codes (ISO 639-1; `pt` ships Brazilian Portuguese). */
export type LocaleCode = keyof typeof DICTS;
export const SUPPORTED_LOCALES = Object.keys(DICTS) as LocaleCode[];

/** BCP-47 tags for `Intl` formatting, keyed by locale code. */
const LOCALE_TAGS: Record<LocaleCode, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
};

/** The active locale code. */
export const locale = writable<LocaleCode>('en');

/** The active locale as a BCP-47 tag (for `Intl.NumberFormat`, etc.). */
export const localeTag: Readable<string> = derived(locale, ($l) => LOCALE_TAGS[$l]);

/**
 * Resolve an arbitrary language hint (e.g. `"de"`, `"de-DE"`, `"en_GB"`) to a
 * supported locale code, defaulting to English when unsupported/empty.
 */
export function resolveLocale(hint?: string | null): LocaleCode {
  const code = (hint ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as string[]).includes(code) ? (code as LocaleCode) : 'en';
}

/** Set the active locale from a language hint. */
export function setLocale(hint?: string | null): void {
  const code = resolveLocale(hint);
  locale.set(code);
  // Keep the document language in sync so assistive tech announces the UI chrome
  // in the right language and `:lang()` rules resolve correctly. The static
  // `lang="en"` in index.html is the pre-boot default; this reflects the
  // resolved locale once the RGS `lang` / `navigator.language` hint is known.
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LOCALE_TAGS[code];
  }
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`
  );
}

function translate(loc: LocaleCode, key: TranslationKey, params?: TranslationParams): string {
  const dict = DICTS[loc] as Partial<Translations>;
  const template = dict[key] ?? en[key] ?? (key as string);
  return interpolate(template, params);
}

/**
 * Reactive translator. Usage in a Svelte template: `{$t('hud.balance')}` or
 * `{$t('a11y.win', { amount })}`. Re-renders when {@link locale} changes.
 */
export const t: Readable<(key: TranslationKey, params?: TranslationParams) => string> = derived(
  locale,
  ($loc) =>
    (key: TranslationKey, params?: TranslationParams): string =>
      translate($loc, key, params)
);

/** Non-reactive translation for use outside Svelte reactivity (logs, core). */
export function tn(key: TranslationKey, params?: TranslationParams): string {
  return translate(get(locale), key, params);
}
