# Changelog

All notable changes to AetherSpin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project aims to use
semantic versioning per game (`shared/games/<id>/game-definition.json`). Versioned
entries below this point are maintained automatically by
[Release Please](https://github.com/googleapis/release-please) from Conventional
Commits.

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
