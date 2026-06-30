# Responsible gaming & legal acknowledgement

How AetherSpin games surface responsible-gaming (RG) and age/legal copy, what the
knobs are, and how an operator enables them per game and per jurisdiction. The
copy shipped here is **operator-agnostic** — neutral defaults you localize and
brand at integration, not legal advice.

## Model: operator-embedded, KYC upstream

These are Stake-Engine-style games that load inside an operator's site or app.
The operator owns the regulated player relationship — **KYC, age verification,
deposit/loss limits, and jurisdictional gating happen upstream**, before the game
iframe loads. So the game ships its RG features **off by default** and exposes a
small, well-defined surface an operator can switch on where its license requires
the game itself to carry the copy.

Two independent surfaces:

1. **Reality check** (player-protection reminder) — a periodic, dismissible modal
   showing time played and net session result. Safe to run alongside upstream
   controls; **on by default** at a 60-minute cadence.
2. **Age / legal acknowledgement gate** — a one-time "you must be 18+ and accept
   the terms" modal that blocks play until acknowledged. **Off by default**
   (operators gate age upstream); opt in per game where required.

## The knobs (`responsibleGaming` in `game-definition.json`)

The block is part of the single-source-of-truth definition and is read by the
frontend via `frontend/src/config/responsibleGaming.ts`. It is **math-neutral** —
the math engine ignores it, so changing it never affects books/RTP/certification.

| Field                 | Type    | Default | Effect                                                                 |
| --------------------- | ------- | ------- | ---------------------------------------------------------------------- |
| `realityCheckMinutes` | integer | unset   | Minutes between reality-check reminders. Unset/0 disables the feature. |
| `helpUrl`             | string  | `""`    | "Get help & set limits" link target (operator help/limits page).       |
| `ageRating`           | integer | unset   | Minimum age shown in the acknowledgement (e.g. `18`).                  |
| `requireAgeAck`       | boolean | `false` | When `true`, show the one-time age/legal gate before play.             |
| `legalDisclaimer`     | string  | `""`    | Extra legal/terms line shown in the age + reality-check dialogs.       |

Current per-game defaults: reality check **on** at 60 min, help link
`begambleaware.org`, `ageRating: 18`, a neutral `legalDisclaimer`, and the age
gate **off** (`requireAgeAck` absent). Enabling the gate for a title is then a
one-field flip.

## The copy (localized)

UI strings live in the locale dictionaries (`frontend/src/locales/*`), so all of
this localizes through the normal i18n path (`en`, `de`, `es`, `pt` ship today):

- Reality check: `rg.title`, `rg.sessionTime`, `rg.netWin` / `rg.netLoss` /
  `rg.netEven`, `rg.disclaimer`, `rg.help`, `rg.continue`, `rg.quit`, `rg.ended`.
- Age/legal gate: `ageGate.title`, `ageGate.body`, `ageGate.confirm`,
  `ageGate.enter` (the `{age}` placeholder is filled from `ageRating`).

The `legalDisclaimer` from the definition is shown verbatim (not a translation
key) so an operator can drop in jurisdiction-specific wording without a rebuild.

## Enabling the age gate per game / jurisdiction

1. Set `responsibleGaming.requireAgeAck: true` (and `ageRating`, e.g. `18`) in the
   game's `game-definition.json`.
2. Optionally set `legalDisclaimer` to the jurisdiction's required wording.
3. Localize `ageGate.*` (and `legalDisclaimer`) for the target markets.

For QA without changing the definition, append `?ageGate=1` to force the gate on
(covered by `frontend/e2e/agegate.spec.ts` on desktop + mobile).

## What this is not

This does not implement deposit/loss/time **limits enforcement**, self-exclusion,
or identity/age **verification** — those are the operator/RGS's responsibility and
are enforced upstream of the game. The game provides the in-game reminder and
acknowledgement surfaces and the hooks to point at the operator's tooling.
