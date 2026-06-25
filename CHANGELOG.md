# Changelog

All notable changes to AetherSpin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project aims to use
semantic versioning per game (`shared/games/<id>/game-definition.json`). Versioned
entries below this point are maintained automatically by
[Release Please](https://github.com/googleapis/release-please) from Conventional
Commits.

## [1.4.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.3.0...v1.4.0) (2026-06-25)


### Features

* **frontend:** render cluster-pays wins and unhide Stellar Clusters ([#41](https://github.com/Ranzlappen/AetherSpin/issues/41)) ([eb026bd](https://github.com/Ranzlappen/AetherSpin/commit/eb026bd12ad2267131c6f3807a7f1c56ac4d8941))
* **math:** add the official-SDK module for Stellar Clusters ([#44](https://github.com/Ranzlappen/AetherSpin/issues/44)) ([ca2c1a6](https://github.com/Ranzlappen/AetherSpin/commit/ca2c1a621e8feafa546e3ea84fc96f2e18fd3479))

## [1.3.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.2.0...v1.3.0) (2026-06-25)


### Features

* **engine:** add cluster mechanic and a third game (Stellar Clusters) ([#39](https://github.com/Ranzlappen/AetherSpin/issues/39)) ([6103003](https://github.com/Ranzlappen/AetherSpin/commit/610300375db3ee604a660146c9cd584daeb0c086))
* **frontend:** add automated accessibility and boot-perf audit to e2e ([#40](https://github.com/Ranzlappen/AetherSpin/issues/40)) ([14c383e](https://github.com/Ranzlappen/AetherSpin/commit/14c383e26f4e38c71a35592e5cc6b8e9c3e70e50))
* **math:** SDK↔standalone parity gate + document the known divergence ([#37](https://github.com/Ranzlappen/AetherSpin/issues/37)) ([d9e0893](https://github.com/Ranzlappen/AetherSpin/commit/d9e0893964bb4697821d7ef77546d808cff4e88e))

## [1.2.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.1.0...v1.2.0) (2026-06-25)


### Features

* roll up post-1.1.0 hardening into v1.2.0 ([#34](https://github.com/Ranzlappen/AetherSpin/issues/34)) ([39d5dd2](https://github.com/Ranzlappen/AetherSpin/commit/39d5dd26ca44c00c6c3345d7a1fd0d113d94e51c))

## [1.1.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.0.0...v1.1.0) (2026-06-24)


### Features

* **cert-readiness:** preflight gate, submission manifest + SBOM, golden-book guard ([b52a820](https://github.com/Ranzlappen/AetherSpin/commit/b52a82055d8f8acb0fe10e43d8c9886c72a58f04))
* **engine:** add ways mechanic + a second game (Cosmic Ways) ([cdaf9ca](https://github.com/Ranzlappen/AetherSpin/commit/cdaf9ca661ac71eabecf402cb339a170365bbcc8))
* **frontend:** multi-game registry + ways rendering (Track 4, batch 3) ([1176475](https://github.com/Ranzlappen/AetherSpin/commit/1176475fdca5c33b92afdfe3dbdf5a05097b6bbc))
* **operator-compliance:** i18n, accessibility, and responsible-gaming UX ([21c05fd](https://github.com/Ranzlappen/AetherSpin/commit/21c05fd6892a396c20f78ffdb281c6dc80697318))
* **quick-wins:** close A11 RNG provenance, add devcontainer + E2E scaffold ([18410e5](https://github.com/Ranzlappen/AetherSpin/commit/18410e59307e9f84b4b2ffe2b764cce555044a10))
* **types:** contract-first codegen — generate TS types from the JSON schema ([028a6fb](https://github.com/Ranzlappen/AetherSpin/commit/028a6fb9e439baae50bf5cae816bfa0b1ea5831b))


### Bug Fixes

* **e2e:** make Playwright suite work headless + harden renderer boot ([8cd0798](https://github.com/Ranzlappen/AetherSpin/commit/8cd079870da4c70cdebf3cd0b376b99933db76c4))
* **frontend:** duplicate-key each in PaytableModal + disambiguate E2E Spin locator ([e7350d9](https://github.com/Ranzlappen/AetherSpin/commit/e7350d94d1d474db0faaee552e2f2a865e60f1ba))
* **frontend:** mount with Svelte 5 mount() — legacy new App() crashed prod bundle ([baca1ab](https://github.com/Ranzlappen/AetherSpin/commit/baca1ab1752fe8d2d151d93a0c4fec082e77f062))

## 1.0.0 (2026-06-24)

Initial release of **AetherSpin** — a production-grade Stake Engine game-studio
monorepo (a reusable math + web engine scaffold) plus the flagship game
**NovaForged** (5×3, 20-line neon-cosmic slot).

### Features

- **Monorepo scaffold** — pnpm workspaces + Turborepo spanning `shared/` (single
  source of truth), `math/` (server math), `frontend/` (game client), `scripts/`,
  and `docs/`.
- **Single source of truth** — `shared/games/<id>/game-definition.json` drives
  BOTH the Python math and the TypeScript frontend; neither side hardcodes
  paytable/symbol values.
- **NovaForged flagship game** — fully tuned 5×3 20-line slot: 96.5% RTP target,
  5000× wincap, high volatility, free-spins feature with a global multiplier
  ladder, scatter triggers/retriggers, and a balanced (never EV-positive)
  buy-bonus.
- **Dual math paths** — a stdlib-only standalone simulator (`math/simulator/`) for
  local dev / CI / RTP / book generation, plus official `StakeEngine/math-sdk`-
  compatible game files (`math/games/<id>/`) for certified submission.
- **Realized multiplier wilds** — the math engine samples a real per-cell wild
  multiplier (SUM rule for participating wilds) and commits it to the book
  (`multiplierWilds` on free-spin reveals); the frontend renders the committed
  values instead of inventing them.
- **RGS client + mock RGS + robustness** — a typed Stake RGS client wrapper with
  request timeouts, bounded retry/backoff on idempotent calls, re-auth on expired
  session, an HTTPS-only guard, book-shape validation before replay, and
  mid-round resume (`BookPlayer.resume`); a local mock RGS for offline play.
- **Contract & integrity enforcement** — JSON-Schema validation of game
  definitions (ajv + a semantic cross-checker) and of generated books, the
  canonical `book.schema.json`, and a cross-engine event-contract test that keeps
  the standalone engine and the SDK game files in lock-step.
- **Deterministic, reproducible library generation** — stable per-mode seeding
  (`PYTHONHASHSEED=0`, fixed offsets) yields byte-identical libraries; provenance
  (seed, definition/reel hashes, simulator version) is stamped into `config.json`.
- **RTP tooling** — `simulate.py`, `optimize.py` (two-knob calibration: global
  paytable scalar + free-spin `winScale`), and `validate_rtp.py --mode all` with a
  buy-bonus compliance gate proving the feature is never player-positive.
- **Quality & security tooling** — mypy on the engine, hypothesis property tests,
  frontend + Python coverage thresholds, CodeQL, gitleaks secret scanning,
  dependency review, and pre-commit hooks.
- **CI/CD & DX** — GitHub Actions for math, contracts, frontend, and blocking
  lint (ESLint 9 flat config + Prettier); nightly high-N RTP validation; Storybook
  deploy to GitHub Pages; and automated releases via Release Please.
- **Docs** — architecture overview, new-game guide, submission checklist, ADRs,
  `SECURITY.md` (server-authoritative outcomes), `CONTRIBUTING.md`, and a
  self-contained `REPO-OVERVIEW.md`.

### Bug Fixes

- **ci:** provision GitHub Pages in Storybook deploy + bump Node 20 → 22 ([#19](https://github.com/Ranzlappen/AetherSpin/issues/19)) ([d0ea595](https://github.com/Ranzlappen/AetherSpin/commit/d0ea5959d8de2fd816b96097a54db9faba23949d))

### Notes

- Measured NovaForged RTP (standalone engine, CI seed): base ~96.2%, buy-bonus
  ~95.4% (not EV-positive). Certified figures come from the official math-sdk
  optimizer at submission time.
- See `docs/IMPROVEMENT-PLAN.md` for the remaining roadmap (Phase B/C).
