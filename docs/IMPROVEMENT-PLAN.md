# AetherSpin — Hardening & Excellence Plan

> Synthesized from **7 independent AI audits** (`Evaluation1–7.MD`) plus a
> first-party verification pass against the actual code. Each finding is tagged
> with **consensus** (how many of the 7 raised it) and **status** (confirmed
> against the source). Effort: **S** ≈ <0.5d · **M** ≈ 0.5–2d · **L** ≈ >2d.
>
> This is a roadmap, not a rewrite. Nothing here is applied yet.

## Context

AetherSpin is meant to be the definitive, reusable starter kit for shipping
**certified** Stake Engine titles. All seven reviewers agreed the architecture is
genuinely strong (single-source-of-truth `game-definition.json`, dual math paths,
typed `BookEvent` contract, clean RGS boundary, scaffolder, docs/ADRs). The work
that remains is **closing the loop**: enforcing the contracts that today are only
conventions, proving (not asserting) the compliance properties, and adding the
last 20% of polish a top-tier studio expects.

Critically, the existing tests are green because they only exercise the
**standalone + mock** path — several of the most dangerous gaps live exactly
where nothing is tested (the certified SDK path and the RGS seams).

---

## The 5 highest-severity issues (consensus + confirmed)

1. **Event-contract drift between the certified SDK path and the frontend.**
   `math/games/novaforged/game_events.py` emits `lineWin`/`freeSpinUpdate` and omits
   `freeSpinEnd`; the canonical contract (`shared/src/types/events.ts`,
   `math/simulator/engine.py`, `bookPlayer.ts`) uses `lineWins`/`freeSpinResult`/
   `freeSpinEnd`. The mock/standalone books hide it; a **certified build renders
   wins incorrectly with every local test green.** _(6/7, confirmed — and
   `game_events.py` even references a non-existent `bookEvents.ts`.)_
2. **Multiplier wilds are an averaged approximation, not realized RNG.**
   `engine.py` collapses `[2,3,5]@[60,30,10]` into `round(weighted_avg)` applied to
   every wild line, and books carry no per-cell multiplier. This distorts
   volatility/PAR/EV and makes faithful frontend presentation impossible. _(2/7,
   confirmed — high severity, low detection because it needs a deep code read.)_
3. **Buy-bonus EV is asserted but not proven.** `test_engine.py` allows
   `bonus rtp < 1.15` on 20k sims while `SECURITY.md` claims "not EV-positive."
   _(5/7, confirmed.)_
4. **Two unverified sources of truth for math.** RTP/PAR are validated on the
   standalone engine, but the **SDK** produces the certified books — no parity
   gate, no book-schema validation, so what you certify ≠ what you validated.
   _(5/7, confirmed.)_
5. **The "single source of truth" is unenforced.** `shared/schemas/…schema.json`
   is never run in CI or at runtime (both sides cast); RTP gate is loose (±5% /
   150k, base-mode only); seeding uses process-salted `hash(mode)` so runs aren't
   reproducible. _(7/7 for schema; 5/7 RTP; 2/7 seeding — all confirmed.)_

---

## Phase A — P0: correctness & credibility (cert blockers)

Do this batch first; it's what stands between "passes locally" and "survives a
lab/operator review."

| #   | Item                                                                                                                                                                                                                                                                                                                                          | Fix (files / tools)                                                                                                                                               | Effort | Consensus |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| A1  | **Unify the event contract + golden-book parity.** Make `game_events.py` emit the exact `BookEvent` union (`lineWins`, `freeSpinResult`, `freeSpinEnd`); fix the stale docstrings/`bookEvents.ts` ref. Add a cross-language **golden-book** test: same seed → standalone & SDK → identical event streams.                                     | `math/games/novaforged/game_events.py`, `game_executables.py`, `gamestate.py`; new `math/tests/test_parity.py`; fixtures in `shared/fixtures/books/`              | M      | 6/7       |
| A2  | **Realized multiplier wilds.** Sample each eligible wild via `Rng.weighted_choice`; emit `multiplierWilds:[{reel,row,value}]` on free-spin `reveal`; use realized values in line eval. Thread through `events.ts`, `bookPlayer.ts`, mock RGS, SDK files, PAR.                                                                                 | `math/simulator/engine.py`, `shared/src/types/events.ts`, `frontend/src/core/bookPlayer.ts`, `frontend/src/scenes/ReelEngine.ts`                                  | M/L    | 2/7       |
| A3  | **Prove buy-bonus EV.** Tighten assertion to `bonus_rtp <= rtpTarget + tol (~0.98)` at ≥200k sims; reconcile `SECURITY.md` wording; gate **both** modes in `validate_rtp.py` + nightly.                                                                                                                                                       | `math/tests/test_engine.py`, `math/scripts/validate_rtp.py`, `.github/workflows/math-validation.yml`, `SECURITY.md`                                               | S      | 5/7       |
| A4  | **Schema enforcement (structural + semantic).** Add `additionalProperties:false`, payline length == numReels, row < numRows, symbol/scatter/wild refs exist, defaultLevelIndex in range. Validate every `shared/games/*/game-definition.json` in CI (ajv) **and** at load time (`jsonschema` in `definition.py`, zod/ajv in `gameConfig.ts`). | `shared/schemas/game-definition.schema.json`, new `scripts/validate-definitions.*`, `ci.yml`, `math/simulator/definition.py`, `frontend/src/config/gameConfig.ts` | M      | 7/7       |
| A5  | **Book validation.** New `math/scripts/validate_books.py`: unique/contiguous ids, `payoutMultiplier <= wincap`, event ordering (`reveal…finalWin`), schema conformance. Wire into `generate_books.py`, `build-all.sh`, `package-for-stake.sh`, CI.                                                                                            | `math/scripts/validate_books.py`, `math/simulator/library.py`                                                                                                     | M      | 2/7       |
| A6  | **Deterministic, auditable seeding.** Replace `hash(mode)` with a fixed map (`{"base":101,"bonus":202}`) or `blake2s`; set `PYTHONHASHSEED=0` in CI; stamp seed + git SHA + definition/reel hashes into `config.json` and the PAR sheet.                                                                                                      | `math/simulator/runner.py`, `math/simulator/library.py`, `ci.yml`                                                                                                 | S      | 2/7       |
| A7  | **RGS robustness + mid-round resume.** `AbortController` timeout, bounded backoff on idempotent calls, re-auth on `ERR_IS`, **resume `auth.round` instead of new spin**, validate `round.book` shape before replay, reject non-HTTPS `rgsUrl`.                                                                                                | `frontend/src/core/rgsClient.ts` (+ `rgsClient.test.ts`), `bookPlayer.ts`, `gameState.ts`                                                                         | M/L    | 5/7       |
| A8  | **Free-spin payout reconciliation.** Make line-win amounts and `freeSpinResult.amount` reconcile (emit `baseAmount`/`globalMultiplier`/`winScale` or pre-scale line amounts); add an invariant test that event sums == `finalWin`.                                                                                                            | `math/simulator/engine.py`, `shared/src/types/events.ts`, `math/tests/test_engine.py`                                                                             | M      | 1/7       |
| A9  | **Fail-closed production guards.** Gate mock RGS behind `import.meta.env.DEV`/`VITE_ENABLE_MOCK_RGS`; production fails closed if `sessionID`/`rgsUrl` missing. Make `package-for-stake.sh` **fatal** on frontend build failure (unless `--math-only`).                                                                                        | `frontend/src/core/mockRgs.ts`, `frontend/src/components/App.svelte`, `scripts/package-for-stake.sh`                                                              | S/M    | 2/7       |
| A10 | **RTP gate credibility.** Keep fast PR smoke; add nightly **confidence-interval** check (std error, base+bonus, hit/feature/wincap frequencies) instead of loose absolute tolerance.                                                                                                                                                          | `math/scripts/validate_rtp.py`, `math-validation.yml`                                                                                                             | M      | 5/7       |
| A11 | **RNG provenance.** Banner in `rng.py`; `docs/rng-provenance.md` distinguishing dev/CI RNG from the certified RGS that selects books in production; add to the submission checklist.                                                                                                                                                          | `math/simulator/rng.py`, `docs/`, `docs/stake-engine-submission-checklist.md`                                                                                     | S      | 4/7       |

---

## Phase B — P1: professional polish

| #   | Item                                                                                                                                                                                                                  | Fix                                                                     | Effort | Consensus |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | --------- |
| B1  | **Python static typing.** Add mypy (or pyright) to `pyproject.toml` + CI; type `simulator/*.py` and `games/novaforged/*.py`.                                                                                          | `math/pyproject.toml`, `ci.yml`                                         | M      | 3/7       |
| B2  | **Property-based math tests.** `hypothesis` (dev-only): payout ≤ wincap for all boards, events well-formed, ordering invariants, all-wild/scatter-only/retrigger edges + golden boards.                               | `math/tests/`, `math/requirements.txt`                                  | M      | 6/7       |
| B3  | **E2E (Playwright).** auth→play→reveal→endRound against mock RGS; bonus buy, insufficient funds, invalid session, mid-round resume, mobile viewport, keyboard.                                                        | `frontend/`, `ci.yml`                                                   | M/L    | 6/7       |
| B4  | **Coverage gates.** `vitest --coverage` + `pytest --cov` with per-package thresholds; upload artifact/badge.                                                                                                          | `ci.yml`, `vite.config.ts`, `pyproject.toml`                            | S      | 5/7       |
| B5  | **Pre-commit hooks.** lefthook/husky+lint-staged: prettier, eslint, svelte-check, ruff, fast pytest, schema validate.                                                                                                 | new `lefthook.yml`/`.husky/`                                            | S      | 6/7       |
| B6  | **CI hardening.** Switch to `--frozen-lockfile`; **stop masking ESLint failures**; add `gitleaks` + CodeQL (TS+Python) + dependency-review; **matrix CI over every `shared/games/*`** (not just NovaForged).          | `.github/workflows/*`                                                   | S/M    | 5/7       |
| B7  | **Storybook + docs deploy.** Build Storybook in CI → GitHub Pages; PR preview deploys; VitePress/Starlight docs site.                                                                                                 | `.github/workflows/`, `.storybook/`                                     | S/M    | 5/7       |
| B8  | **Richer, committed PAR + release automation.** Per-release PAR under `docs/par-sheets/<game>/<version>/` (base+bonus, contributions, variance, CIs, hashes); Changesets/release-please for changelog + version sync. | `math/scripts/generate_par_sheet.py`, `release.yml`, new `CHANGELOG.md` | M      | 5/7       |
| B9  | **Repro/onboarding.** `.python-version`, `CONTRIBUTING.md`, `.devcontainer/`, populate `CODEOWNERS` with teams.                                                                                                       | repo root, `.github/`                                                   | S/M    | 3/7       |
| B10 | **Branded money types.** TS `Dollars`/`ApiAmount`/`BookPayoutUnits`/`BetMultiplier` + Python helpers; round-trip conversion tests.                                                                                    | `frontend/src/core/amount.ts`, `shared/src/`                            | M      | 1/7       |

---

## Phase C — P2: scale, UX & compliance

| #   | Item                                                                                                                                                                                                                                  | Fix                                                                | Effort | Consensus |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ | --------- |
| C1  | **Responsible Gaming module.** Session timer, reality-check modal, loss/time limits, autoplay caps + stop conditions, RTP/volatility readout from the definition, helpline footer, jurisdiction config; `docs/RESPONSIBLE_GAMING.md`. | `frontend/src/components/`, `gameState.ts`, schema `rg` block      | M      | 7/7       |
| C2  | **i18n.** svelte-i18n/FormatJS; extract strings to `locales/*.json`; wire the parsed `lang`; locale-driven currency via `Intl`; add a 2nd locale (RTL check).                                                                         | `frontend/src/`, new `locales/`                                    | M      | 7/7       |
| C3  | **Accessibility.** Keyboard handlers, `prefers-reduced-motion`, modal focus trap, `<html lang>`, `aria-live` win/feature announcements, contrast audit; axe/Lighthouse in CI.                                                         | `frontend/src/`, `global.css`, `ci.yml`                            | M      | 6/7       |
| C4  | **Performance budgets.** Playwright frame-budget trace on a scripted spin, bundle-size budget (size-limit), texture/ticker disposal + WebGL context-loss handling, adaptive FX, asset preload phase.                                  | `frontend/src/scenes/Stage.ts`, `ReelEngine.ts`, `ci.yml`          | M      | 6/7       |
| C5  | **Engine generalization + 2nd game type.** Extract `BaseEngine`; add a minimal **ways** (or cluster) example; make `new-game.sh` scaffold from declared mechanics, not a NovaForged clone.                                            | `math/simulator/engine.py`, `scripts/new-game.sh`, `shared/games/` | L      | 6/7       |
| C6  | **Multi-game frontend.** `VITE_GAME_ID` build-time selection + per-game theme/asset namespaces so new titles need no core source edits (`gameConfig.ts` currently hardcodes NovaForged).                                              | `frontend/src/config/gameConfig.ts`, `vite.config.ts`              | M/L    | 2/7       |
| C7  | **Asset pipeline.** Pixi `Assets` manifest, texture atlas/compression, audio sprites, preload groups, CDN cache-busting, missing-asset CI.                                                                                            | `frontend/src/config/assets.ts`                                    | M      | 4/7       |
| C8  | **Telemetry / error boundary (PII-free, opt-in).** Svelte error boundary; no-op `telemetry.ts` (spin/bonus/load timings, RGS latency, replay errors, FPS buckets).                                                                    | `frontend/src/core/`, `components/`                                | S/M    | 5/7       |
| C9  | **Certification artifact bundle.** `submission-manifest.json` (game version, git SHA, definition/reel/book/lookup/PAR/bundle hashes, env, sign-offs) + SBOM (CycloneDX) + checksums in `dist-stake`.                                  | `scripts/package-for-stake.sh`, `release.yml`                      | M      | 4/7       |

---

## Structural bets (do a few of these and many rows above collapse)

These are the force-multipliers — worth prioritizing inside their phases:

1. **Contract-first codegen (A1+A4+A8).** Make a single `shared/schemas/book-event.schema.json` (+ the definition schema) the _source_, and generate the TS `BookEvent` types, a Python validator, and test fixtures from it. Schema/event drift becomes _structurally impossible_ instead of a convention. _(Raised by Evals 4, 5, 7.)_
2. **Golden-book corpus + parity in CI (A1).** A small committed set of seeded reference books, replayed by **both** Python tests and the frontend, asserted byte-identical — the only real guard against math↔client drift and silent math regressions.
3. **`scripts/preflight.sh <game>` (A4+A5+A10).** One command that runs the entire certification gate (schema, RTP@1M with CIs, book validation, PAR, version/hash sync, wincap) and prints a green/red mirror of `docs/stake-engine-submission-checklist.md`.
4. **Engine plugin architecture (C5).** `lines`/`ways`/`cluster` as modules with a shared conformance suite, replacing wholesale cloning — this is what makes "reusable for many titles" true rather than aspirational.
5. **QA replay viewer.** A `?mode=replay&book=…` entry point so auditors/support/streamers can render any outcome (e.g. a 5000× win) on demand. _(Evals 2, 3.)_

---

## Recommended first PR ("Phase A core" — highest leverage, ~2–4 days)

1. **A4** schema validation in CI + at load (structural + semantic).
2. **A1** unify event contract + golden-book parity test.
3. **A3** prove buy-bonus EV (tighten test, gate both modes).
4. **A6** deterministic seeding + reproducibility stamps.
5. **A5** book validation wired into packaging + CI.

This batch directly neutralizes risks #1, #3, #4, #5 and makes the "single source
of truth / interchangeable math paths" claims real and enforced. **A2** (realized
multiplier wilds) and **A7** (RGS resume) are the natural second PR.

---

## Verification (per phase)

- **Math/contract:** `python -m pytest math/tests` (incl. new parity + property +
  reconciliation tests); `python math/scripts/validate_rtp.py --game novaforged --sims 1000000 --tol 0.03`;
  `python math/scripts/validate_books.py`; schema validation over `shared/games/*`.
- **Frontend:** `pnpm --filter @aetherspin/frontend test --coverage`; `svelte-check`;
  new Playwright suite vs mock RGS; Storybook build.
- **End-to-end:** `bash scripts/build-all.sh novaforged` then
  `bash scripts/package-for-stake.sh novaforged` must pass with book validation;
  `bash scripts/new-game.sh smoketest` then simulate+validate the scaffold to prove reusability.
- **Repro:** assert `generate_books.py --seed S` is byte-identical across two runs
  with `PYTHONHASHSEED=0`.

---

## Housekeeping note

The seven source audits live at repo root as `Evaluation1–7.MD`. Recommend moving
them to `docs/external-reviews/` (and adding this file as
`docs/IMPROVEMENT-PLAN.md`) so the root stays clean. Not done automatically.
