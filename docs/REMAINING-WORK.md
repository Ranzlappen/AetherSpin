# Remaining work

Status snapshot after the SDK-certification push. Grouped by track, with an
honest note on what's blocking each. Everything here is **post-engineering**
polish, content, or process — the three games run on the real certified SDK
path, pass the SDK's own RGS verification, and the optimizer solves RTP to 0.965.

## 1. Math / certification

- [x] **Production-scale optimizer run** per game — DONE at 200k base / 60k bonus.
      All three hit **RTP 0.9650 exact** (base & bonus). Certified white papers in
      [`docs/white-papers/`](white-papers/). To re-run at full production counts
      (1e6 / 2e5) before submission: `scripts/run-certification.sh <game>`.
- [ ] **Per-game volatility/profile tuning.** All three currently share the same
      optimizer constraints (hit-rate, free-spin frequency 1-in-200, RTP split), so
      their headline frequencies are identical; only volatility differs by mechanic
      (CV ≈ 9 / 12 / 12.5). Tune `game_optimization.py` per title if distinct
      profiles are wanted.
- [x] **PAR sheets** generated from the certified library —
      [`docs/white-papers/<game>-white-paper.md`](white-papers/). Have a math
      reviewer sign off the hit/free-spin/win-cap frequencies and max-win before
      submission.
- [ ] _(Known, low priority)_ **Ways multiplier-wild reconciliation** — moot while
      Cosmic Ways disables multiplier wilds (`values: [1]`); only needed if it ever
      enables `>1` wilds (the SDK's ways `"symbol"` strategy differs from the
      standalone's additive sum). See ADR 0005.

## 2. Frontend / product

- [ ] **Final art + audio** — replace placeholders. Full list in
      [`docs/artwork-checklist.md`](artwork-checklist.md) / `docs/asset-spec.md`.
      The pipeline is a drop-in file swap for the required set.
- [ ] **Per-game art theming** (optional) — all three games share one symbol set
      today. Namespacing keys per game needs a ~1-line change in
      `config/assets.ts` + `ReelEngine`.
- [ ] **Recommended visual additions** (not wired) — background plates, board
      frame, logos, loading screen, win/free-spin FX cards. Each needs a small,
      scoped hook; do per asset as art arrives.
- [ ] **Compliance copy review** — responsible-gaming / legal / jurisdictional
      text reviewed by compliance (human step). The age/legal gate exists but
      ships **off** (operators gate KYC upstream); enable per game if required.
- [ ] **Localization** — `en` + `de` ship; add locales if target markets need them.

## 3. Process / submission

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
