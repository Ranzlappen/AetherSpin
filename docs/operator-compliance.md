# Operator compliance (i18n · accessibility · responsible gaming)

The frontend ships three operator-facing compliance systems. All are
client-side UX; **outcomes remain server-authoritative** (see `SECURITY.md`) —
none of this affects RNG, payouts, or balances.

## Internationalization (i18n)

- `frontend/src/core/i18n.ts` — a dependency-free i18n layer. The active locale
  is a Svelte store; `$t('key', params)` is reactive and re-renders on change.
- `frontend/src/locales/en.ts` is the **canonical dictionary** — it defines the
  legal key set and the fallback text. Other locales (`de.ts`) are
  `Partial<Translations>`; any missing key falls back to English, so a
  half-translated locale is always safe. Type-checking enforces valid keys.
- Locale resolution at boot: RGS `lang` param → (future: `navigator.language`)
  → English. Currency/number formatting follows the locale via `Intl`.

**Add a locale:** create `frontend/src/locales/<code>.ts` exporting a
`Partial<Translations>`, register it in the `DICTS` map and `LOCALE_TAGS` in
`i18n.ts`. Translate as many keys as you like; the rest fall back to English.

> Scope note: the data-driven paytable feature copy is still sourced (in
> English) from `game-definition.json`. The UI chrome and a11y/RG strings are
> fully localized; translating definition-sourced copy is a follow-up.

## Accessibility (a11y)

- **Live region** — the Pixi canvas is opaque to assistive tech, so spin
  start / win / feature / wincap outcomes are mirrored into a polite ARIA live
  region (`core/a11y.ts` → `announce()`, rendered by `App.svelte`).
- **Keyboard** — `Space`/`Enter` spins when no control owns focus; all controls
  are real `<button>`s with localized `aria-label`s; `:focus-visible` rings.
- **Reduced motion** — `prefers-reduced-motion` is honored in CSS (animations
  collapsed) and in the renderer (`Stage.setReducedMotion()` skips celebration
  particle bursts). Follows OS changes mid-session.

## Responsible gaming (RG)

- Config lives in the canonical definition (optional `responsibleGaming` block:
  `realityCheckMinutes`, `helpUrl`), surfaced via
  `frontend/src/config/responsibleGaming.ts` with safe defaults.
- `core/session.ts` tracks elapsed play time and net position and raises a
  periodic **reality check**. `components/RealityCheck.svelte` is a modal,
  focus-managed reminder showing time played + net result, a help/limits link,
  and an explicit _continue_ / _take a break_ choice. Informational only and
  never EV-affecting; hard limits/self-exclusion stay with the operator/RGS.
