# Remaining work

Status snapshot after the SDK-certification push. Grouped by track, with an
honest note on what's blocking each. Everything here is **post-engineering**
polish, content, or process — the three games run on the real certified SDK
path, pass the SDK's own RGS verification, and the optimizer solves RTP to 0.965.

## 1. Math / certification

- [ ] **Production-scale optimizer run** per game. The optimizer is proven here
      at 100k base / 40k bonus sims (RTP 0.9650 exact). Before actual submission,
      re-run at production counts (`run.py` defaults: 1e6 base / 2e5 bonus) for
      tighter convergence and the real distributions:
      `scripts/run-certification.sh <game>`.
- [ ] **Review the Cosmic Ways / Stellar Clusters RTP allocation.** Their
      `game_optimization.py` splits base RTP free-game-heavy (heuristic that
      converged at proof scale). Confirm the per-criteria split still hits target
      and the volatility/hit-rate look right at production scale.
- [ ] **PAR sheet review** from the certified (post-optimization) library — not
      the standalone estimate. `package-for-stake.sh` + the SDK analysis output
      feed this; have a math reviewer sign off hit-frequency, free-spin frequency,
      win-cap frequency, and max-win.
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

- [ ] **Land PR #57.** It's a large draft (SDK ports + production hardening +
      optimizer). Decide: mark ready for review and merge as-is, or split.
- [ ] **Release** — release-please cuts the version bump on merge to `main`.
- [ ] **Dashboard upload** — the manual Stake Engine steps (create game, upload
      library + frontend bundle, set RTP/config, staging playthrough, submit for
      certification). See `docs/stake-engine-submission-checklist.md` §7.
- [ ] **External certification** — Stake's own review after upload.

## 4. Nice-to-have / hardening (optional)

- [ ] e2e the age gate on `mobile-chromium` too (desktop covered).
- [ ] Add a CI job that runs `run-certification.sh` nightly where Rust + 3.12 are
      available (currently a manual/submission step).
- [ ] Per-game volatility tuning (the optimizer hit-rate constraints are sane
      defaults, not tuned per title).
