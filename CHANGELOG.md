# Changelog

All notable changes to AetherSpin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project aims to use
semantic versioning per game (`shared/games/<id>/game-definition.json`).

## 1.0.0 (2026-06-24)


### Bug Fixes

* **ci:** provision GitHub Pages in Storybook deploy + bump Node 20 → 22 ([#19](https://github.com/Ranzlappen/AetherSpin/issues/19)) ([d0ea595](https://github.com/Ranzlappen/AetherSpin/commit/d0ea5959d8de2fd816b96097a54db9faba23949d))

## [Unreleased]

### Added

- **Realized multiplier wilds** — the math engine samples a real per-cell wild
  multiplier and commits it to the book (`multiplierWilds` on free-spin reveals);
  the frontend renders the committed values instead of inventing them.
- **RGS robustness** — request timeouts, bounded retry/backoff on idempotent
  calls, re-auth on expired session, HTTPS-only guard, book-shape validation, and
  mid-round resume (`BookPlayer.resume`).
- **Contract & integrity enforcement** — JSON-Schema validation of game
  definitions (ajv + semantic checks) and generated books, the canonical
  `book.schema.json`, and a cross-engine event-contract test.
- **Quality tooling** — mypy on the engine, hypothesis property tests, coverage
  thresholds (frontend + Python), CodeQL + gitleaks + dependency-review,
  pre-commit hooks, `CONTRIBUTING.md`.
- Deterministic, reproducible library generation (stable seeding + provenance
  hashes in `config.json`); buy-bonus RTP gate (`validate_rtp.py --mode all`).

### Notes

- Measured NovaForged RTP (standalone engine, CI seed): base ~96.2%, buy-bonus
  ~95.4% (not EV-positive). Certified figures come from the official math-sdk.
- See `docs/IMPROVEMENT-PLAN.md` for the remaining roadmap (Phase B/C).

## [1.0.0] — initial

- AetherSpin monorepo scaffold + flagship game **NovaForged** (5x3, 20-line):
  shared single-source-of-truth definition; dual math paths (standalone simulator
  and official-SDK game files); Svelte/PixiJS client with an RGS client + mock
  RGS; CI/CD; docs; and ADRs.
