# Changelog

All notable changes to AetherSpin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project aims to use
semantic versioning per game (`shared/games/<id>/game-definition.json`). Versioned
entries below this point are maintained automatically by
[Release Please](https://github.com/googleapis/release-please) from Conventional
Commits.

## [2.0.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.11.2...v2.0.0) (2026-07-23)


### ⚠ BREAKING CHANGES

* the Cosmic Ways and Stellar Clusters titles are removed; the studio ships the single flagship game (internal id stays `novaforged`).

### Features

* **frontend:** visual completeness pass for release readiness ([99aa03f](https://github.com/Ranzlappen/AetherSpin/commit/99aa03fdaf5952361577b628c4217938b712dc9c))
* NovaForge single-title release — rename, music, warp field, HUD extras ([e2267b2](https://github.com/Ranzlappen/AetherSpin/commit/e2267b26e865810c360d5f2c7a7d342b5f151f77))


### Bug Fixes

* **frontend:** frame to 17% + move it to the foreground over the reels ([c51b514](https://github.com/Ranzlappen/AetherSpin/commit/c51b5144c9cc42673303fac45401c36fae3e29b0))
* **frontend:** scale the reel frame down ~15% so it hugs the reels ([ef6aa2d](https://github.com/Ranzlappen/AetherSpin/commit/ef6aa2da487b314a9d2a18121141b1146978079f))
* **frontend:** scale the reel frame down ~15% so it hugs the reels ([a04506c](https://github.com/Ranzlappen/AetherSpin/commit/a04506c08b91205519b7c4905364eca5c0066ede))
* **frontend:** size the frame from its true opening so it never clips symbols ([798936c](https://github.com/Ranzlappen/AetherSpin/commit/798936ce6dbfce2aa1993d836b46301ae5692ad1))

## [1.11.2](https://github.com/Ranzlappen/AetherSpin/compare/v1.11.1...v1.11.2) (2026-07-14)


### Bug Fixes

* **ci:** read compressed SDK books with the SDK interpreter in sdk-parity ([2d438ef](https://github.com/Ranzlappen/AetherSpin/commit/2d438effe7b0a5221050246a6aa0f21f7702a097))
* **ci:** unbreak SDK Parity — read compressed books with the SDK interpreter ([eb25f3d](https://github.com/Ranzlappen/AetherSpin/commit/eb25f3df144c12b61780e14d9d4fb51fcb9f35f2))
* **frontend:** animate free spins + solid, gap-free reel cabinet ([eedc288](https://github.com/Ranzlappen/AetherSpin/commit/eedc28814315cfc44da56717ee45d49139e72fc3))
* **frontend:** animate free spins + solid, gap-free reel cabinet ([1f61457](https://github.com/Ranzlappen/AetherSpin/commit/1f61457587e149fa42ae21784152b50be00f7b15))

## [1.11.1](https://github.com/Ranzlappen/AetherSpin/compare/v1.11.0...v1.11.1) (2026-07-13)


### Bug Fixes

* **frontend:** correct board scaling on high-DPR devices + real payta… ([2ccb806](https://github.com/Ranzlappen/AetherSpin/commit/2ccb806028ce9acb55101e9a37356c8d104d8996))
* **frontend:** correct board scaling on high-DPR devices + real paytable art ([05884f9](https://github.com/Ranzlappen/AetherSpin/commit/05884f99d8c3ce2a3d6bb1b72eac38d7c10ffde5))

## [1.11.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.10.1...v1.11.0) (2026-07-12)


### Features

* defense-in-depth — fail-closed mock RGS, bundle checksum re-verify, pinned release actions ([11f217e](https://github.com/Ranzlappen/AetherSpin/commit/11f217e68c47a42392c5b0e7d9abbb27c8f2eca4))
* defense-in-depth — fail-closed mock RGS, bundle checksum re-verify, pinned release actions ([4c01d82](https://github.com/Ranzlappen/AetherSpin/commit/4c01d82c188b4795b5d17ede8809230f5a696a50))


### Bug Fixes

* **frontend:** make board layout watertight across all viewports ([0212646](https://github.com/Ranzlappen/AetherSpin/commit/021264650eea9eb917e8f07d1401c817f8e017a9))
* **frontend:** make board layout watertight across all viewports ([2e8d0ec](https://github.com/Ranzlappen/AetherSpin/commit/2e8d0ec07c3a243f742e789439b8507c2baf084e))
* opt e2e + Pages demo builds into the mock RGS (fail-closed regression) ([1e1aff2](https://github.com/Ranzlappen/AetherSpin/commit/1e1aff2e0d183ddbc10e6188ec11bd321220681e))

## [1.10.1](https://github.com/Ranzlappen/AetherSpin/compare/v1.10.0...v1.10.1) (2026-07-10)


### Bug Fixes

* install toml for the SDK optimizer driver on fresh runners ([74fbcae](https://github.com/Ranzlappen/AetherSpin/commit/74fbcae1f7fe9ee042ac04bb8c646fbb403cb368))

## [1.10.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.9.0...v1.10.0) (2026-07-09)


### Features

* install final SFX set and upgrade win-line highlights to neon g… ([a0ffc7f](https://github.com/Ranzlappen/AetherSpin/commit/a0ffc7f0df0fcfb0c3504627bfa2536eb9a589ca))
* install final SFX set and upgrade win-line highlights to neon glow presentation ([66e2855](https://github.com/Ranzlappen/AetherSpin/commit/66e285546742985249f0791ab84d1937e56f09d9))

## [1.9.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.8.0...v1.9.0) (2026-07-09)


### Features

* certified-library packaging path, provenance stamping, and Python 3.12 SDK toolchain fixes ([5c335e3](https://github.com/Ranzlappen/AetherSpin/commit/5c335e329e386c2cd6315a4ffaa168cac97029dc))
* fail-closed packaging with library grade + provenance stamped into the bundle ([f9af935](https://github.com/Ranzlappen/AetherSpin/commit/f9af9355a42ff60830249cd18c74c4514cd6e6f0))
* integrate final artwork — symbols, background, frame, logo, win/free-spins plates, icons ([2ce2111](https://github.com/Ranzlappen/AetherSpin/commit/2ce2111477f1c38bb6bc558468b783845dc4b8c4))
* turbo mode, tap-to-skip, tiered win celebrations, autoplay limits, full paytable i18n ([a014701](https://github.com/Ranzlappen/AetherSpin/commit/a01470138fc30776bad8c254a5c49253e1f749e2))


### Bug Fixes

* reconcile volatility labels with certified white papers and stale doc references ([b1798df](https://github.com/Ranzlappen/AetherSpin/commit/b1798dfee8faba9aa27319fe9c324f7e2d4fed46))
* reconcile volatility labels with certified white papers and stale doc references ([5d8b221](https://github.com/Ranzlappen/AetherSpin/commit/5d8b221c77be5a2148c01d721fe89c9290e2df0d))

## [1.8.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.7.0...v1.8.0) (2026-07-01)


### Features

* all three games on the real StakeEngine SDK (RGS-conformant) + production hardening ([9d7e60c](https://github.com/Ranzlappen/AetherSpin/commit/9d7e60cd4e37b964e4a1ad52181281773128cf7b))
* **assets:** per-game symbol-art theming seam ([09c02f3](https://github.com/Ranzlappen/AetherSpin/commit/09c02f3b27942b1c50b055b22acab15c6b4afb31))
* **cosmicways:** fail-fast guard on realized ways multiplier wilds ([821f2c1](https://github.com/Ranzlappen/AetherSpin/commit/821f2c1718e0e8f4460475fa212d205563eed81f))
* **frontend:** config-gated age/legal acknowledgement (off by default) ([17560e5](https://github.com/Ranzlappen/AetherSpin/commit/17560e5b63c968c043a287b3ad2e22f6d141fee3))
* **frontend:** harden RGS settle recovery + deepen book validation ([e317485](https://github.com/Ranzlappen/AetherSpin/commit/e3174858173aefa4e3bb1b8b67d9c7d20a26154c))
* **i18n:** add Spanish + Brazilian Portuguese locales ([fe3e5cd](https://github.com/Ranzlappen/AetherSpin/commit/fe3e5cd22e467cc3836dabe4af2bf45ddfb07b6a))
* **math:** add WCAP reels + forced win-cap distributions (all three games) ([7954b94](https://github.com/Ranzlappen/AetherSpin/commit/7954b946a8b15c7c2415a7080081633e8e95b519))
* **math:** certified optimizer run for all three games (RTP solved to target) ([372ade5](https://github.com/Ranzlappen/AetherSpin/commit/372ade575faa2a7b96ff599117f8e4a279738f63))
* **math:** emit the shared BookEvent contract from the NovaForged SDK module ([1293510](https://github.com/Ranzlappen/AetherSpin/commit/1293510a8ee369bb462d41f458866059bd0d2dc8))
* **math:** layer NovaForged free-game mechanics into the SDK module ([b52bad2](https://github.com/Ranzlappen/AetherSpin/commit/b52bad2f4960afa6fce851109b0209423fd42131))
* **math:** port Cosmic Ways + Stellar Clusters to the real SDK API ([4675f73](https://github.com/Ranzlappen/AetherSpin/commit/4675f73aa6bef372653df82fcbd5bdf6bcb1860d))
* **math:** port NovaForged SDK module to the real math-sdk API (it runs) ([97c820e](https://github.com/Ranzlappen/AetherSpin/commit/97c820ec6c210de2d52ccd82bd3ecb7dccaeba2f))
* **math:** white-paper generator + certified-run fixes (realpath, xlsxwriter) ([1e7d806](https://github.com/Ranzlappen/AetherSpin/commit/1e7d806bbc1c0d9f705db976a24bbd05d3b889ca))
* **scripts:** guard game version + definitionHash across definition/config/bundle ([df0569a](https://github.com/Ranzlappen/AetherSpin/commit/df0569a28d4c8d089369cdcf0ae6a64d9f9eead4))


### Bug Fixes

* **math:** quantize NovaForged SDK payouts to 0.1x for RGS conformance ([f62e09f](https://github.com/Ranzlappen/AetherSpin/commit/f62e09f4515aa0e5b304db928c0e5f6b9ff0e836))
* **math:** reset per-mode payout sidecar so SDK execute_all_tests passes ([3f901db](https://github.com/Ranzlappen/AetherSpin/commit/3f901db54c58e3cce78a5cdc5ffbecdbf3acd394))
* **math:** stabilise run.py threading for the certified production run ([627fe03](https://github.com/Ranzlappen/AetherSpin/commit/627fe03f39f9739b5e08a5b707cdc2f727d68533))

## [1.7.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.6.0...v1.7.0) (2026-06-28)


### Features

* **frontend:** add synthesized placeholder SFX ([#54](https://github.com/Ranzlappen/AetherSpin/issues/54)) ([15acbae](https://github.com/Ranzlappen/AetherSpin/commit/15acbaec598a826e2edec80619e6aa30332755e4))

## [1.6.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.5.0...v1.6.0) (2026-06-28)


### Features

* **frontend:** add neon-cosmic placeholder symbol art ([#52](https://github.com/Ranzlappen/AetherSpin/issues/52)) ([b79bcfc](https://github.com/Ranzlappen/AetherSpin/commit/b79bcfcece69c3375dbe8a9501ebc0075d59b036))

## [1.5.0](https://github.com/Ranzlappen/AetherSpin/compare/v1.4.0...v1.5.0) (2026-06-28)


### Features

* **frontend:** activate the asset pipeline (preload + texture fallback + missing-asset guard) ([#51](https://github.com/Ranzlappen/AetherSpin/issues/51)) ([bf9d97b](https://github.com/Ranzlappen/AetherSpin/commit/bf9d97be7d72dc320d60af23963fc1fb3778658e))
* **sdk:** realize NovaForged multiplier wilds and make the parity gate free-game-aware ([#49](https://github.com/Ranzlappen/AetherSpin/issues/49)) ([2bc9a4a](https://github.com/Ranzlappen/AetherSpin/commit/2bc9a4a711bfcaa5b241888d7b091cc73ce6f1fc))


### Bug Fixes

* **ci:** retune novaforged RTP to target and de-flake the nightly + e2e ([#47](https://github.com/Ranzlappen/AetherSpin/issues/47)) ([1a3bf88](https://github.com/Ranzlappen/AetherSpin/commit/1a3bf88f364b61e1f04079ee5ce3af2a85beb310))

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
