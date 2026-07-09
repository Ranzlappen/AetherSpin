# Remaining work

Status snapshot after the SDK-certification push. Grouped by track, with an
honest note on what's blocking each. Everything here is **post-engineering**
polish, content, or process — the three games run on the real certified SDK
path, pass the SDK's own RGS verification, and the optimizer solves RTP to 0.965.

## 1. Math / certification

- [x] **Production-scale optimizer run** per game — DONE at **full production
      counts (1e6 base / 2e5 bonus)**. All three hit **RTP 0.9650 exact** (base &
      bonus), converging within a tight 0.02 tolerance; base lookup tables carry
      ~1,000,000 distinct outcomes. Certified white papers regenerated from these
      libraries in [`docs/white-papers/`](white-papers/). Reproduce:
      `scripts/run-certification.sh <game>`.
- [ ] **Per-game volatility/profile tuning.** All three currently share the same
      optimizer constraints (hit-rate, free-spin frequency 1-in-200, RTP split), so
      their headline frequencies are identical; only volatility differs by mechanic
      (CV ≈ 9 / 12 / 12.5). Tune `game_optimization.py` per title if distinct
      profiles are wanted.
- [x] **PAR sheets** generated from the certified library —
      [`docs/white-papers/<game>-white-paper.md`](white-papers/). Have a math
      reviewer sign off the hit/free-spin/win-cap frequencies and max-win before
      submission.
- [x] **NovaForged certified run + strict parity re-verified** (2026-07-04,
      against the volatility-reconciled definition, hash `8ccc93368f60…`):
      full SDK pipeline (1e6 base / 2e5 bonus + Rust optimizer) → RTP
      **0.9650 exact** both modes; SDK RGS verifier green (SHA-256 + payout
      hash, 999,984 / 200,000 entries); `run-sdk-parity.sh --strict` **PASS**;
      white paper regenerated; certified bundle packaged via
      `package-for-stake.sh novaforged --certified` (grade `sdk-certified`
      stamped in the manifest).
- [ ] _(Known, informational)_ **SDK 3-star volatility limits — bonus mode.**
      The SDK's `rgs_verification` warns that the 100× buy-bonus exceeds
      3-star volatility limits (`etl40b` 1.04 > 0.9, `cvar` 2293 > 800) —
      inherent to a 100× buy with a 5000× cap (bonus CV ≈ 207, documented in
      the white paper). Base mode passes. If Stake's review requires the
      bonus to fit a specific star rating, retune `game_optimization.py`'s
      bonus distribution; otherwise disclose as-is.
- [ ] _(Known, low priority)_ **Ways multiplier-wild reconciliation** — moot while
      Cosmic Ways disables multiplier wilds (`values: [1]`); only needed if it ever
      enables `>1` wilds (the SDK's ways `"symbol"` strategy differs from the
      standalone's additive sum). See ADR 0005. A guard in
      `math/games/cosmicways/game_config.py` now **fails fast** if a ways game
      declares `>1` wilds before that reconciliation lands, so it can't silently
      mis-pay.

## 2. Frontend / product

- [x] **Final art** — integrated: all 11 symbols (512² WebP with alpha),
      nebula background plate, reel-board frame, NovaForge logo (loading
      screen), big-win burst (celebration overlay), free-spins intro card
      (feature splash), and app icons (192/512 PNG + favicon links). Every
      piece keeps its procedural fallback, and the missing-asset guards +
      `e2e/assets.spec.ts` verify each loads.
- [x] **Final SFX** — all 7 delivered clips installed (`public/audio/*.wav`,
      44.1 kHz/16-bit, clean peaks); drop-in swap, no code change. Win-line
      highlights upgraded to layered neon strokes + an additive cell-glow
      flare (`fx/line-glow.webp`, generated + wired).
- [ ] **Music** (optional) — no base/free-spins loops yet; needs a small loop
      manager in `sound.ts` when tracks arrive (`docs/asset-spec.md` §3).
- [ ] **Per-game art theming** (optional) — all three games share the one
      (NovaForged-themed) symbol set. The `THEMED_SYMBOL_SETS` seam in
      `config/assets.ts` takes per-game overrides as a pure data change.
- [ ] _(Note)_ The delivered logo reads "NovaForge" (no trailing "d") while the
      game's display name is "NovaForged" — confirm or revise the wordmark.
- [x] **Player-experience feature set** — turbo/quick-spin, tap-to-skip
      presentation (never outcomes), tiered BIG/MEGA/EPIC/MAX win celebration
      overlay (`WinCelebration.svelte`, art-agnostic with a `data-tier` art
      hook), and autoplay **loss-limit / single-win-limit / stop-on-feature**
      stop conditions (`core/autoplay.ts`, see `docs/RESPONSIBLE_GAMING.md`).
- [ ] **Compliance copy review** — responsible-gaming / legal / jurisdictional
      text reviewed by compliance (human step). The age/legal gate exists but
      ships **off** (operators gate KYC upstream); enable per game if required.
- [x] **Localization** — `en`, `de`, `es`, `pt` ship, including the full
      paytable/feature copy (built from definition numbers, not English
      description fields) and all new feature strings; an i18n completeness
      test guards the player-facing key families. Add locales if target
      markets need more.

## 3. Process / submission

- [ ] **Set real CODEOWNERS** — `.github/CODEOWNERS` still lists placeholder
      owners; replace them with real GitHub usernames/teams before submission.
- [ ] **Land PR #57.** Large PR (SDK ports + production hardening + optimizer),
      now **marked ready for review** (out of draft). Get review + required checks
      green, then decide: merge as-is or split.
- [ ] **Release** — release-please cuts the version bump on merge to `main`.
- [ ] **Dashboard upload** — the manual Stake Engine steps (create game, upload
      library + frontend bundle, set RTP/config, staging playthrough, submit for
      certification). See `docs/stake-engine-submission-checklist.md` §7.
- [ ] **External certification** — Stake's own review after upload.

## 4. Nice-to-have / hardening (optional)

- [x] e2e the age gate on `mobile-chromium` too — `frontend/e2e/agegate.spec.ts`
      runs under both the `desktop-chromium` and `mobile-chromium` Playwright
      projects (no project restriction), so it's covered on mobile already.
- [x] Add a CI job that runs `run-certification.sh` nightly where Rust + 3.12 are
      available — `.github/workflows/certification.yml` (nightly 04:00 UTC +
      `workflow_dispatch`). Fail-soft on toolchain/SDK absence; asserts optimized
      RTP convergence via `scripts/assert_certified_rtp.py`.
- [ ] Per-game volatility tuning (the optimizer hit-rate constraints are sane
      defaults, not tuned per title).
