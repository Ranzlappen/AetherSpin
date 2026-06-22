# CLAUDE.md

Guidance for AI assistants and developers working in this repository.

## What this is

AetherSpin — a production-grade **Stake Engine game studio monorepo**. It is a
reusable math + web engine scaffold plus a complete flagship game, **NovaForged**
(5×3, 20-line neon-cosmic slot).

## Layout

- `shared/` — the **single source of truth**. `shared/games/<id>/game-definition.json`
  drives BOTH the Python math and the TS frontend. Change game numbers here.
- `math/` — server math. `math/simulator/` is a stdlib-only standalone engine
  (local dev, CI, RTP, book generation). `math/games/<id>/` are official
  `StakeEngine/math-sdk`-compatible game files for certified submission.
- `frontend/` — Vite + Svelte + TypeScript + PixiJS game client with an RGS
  client wrapper and a local mock RGS.
- `scripts/` — `setup-math.sh`, `package-for-stake.sh`, `build-all.sh`, `new-game.sh`.
- `docs/` — architecture, new-game guide, submission checklist, ADRs.

## Common commands

```bash
python math/scripts/simulate.py --game novaforged --sims 100000     # RTP + stats
python math/scripts/validate_rtp.py --game novaforged --sims 200000 # gate RTP
python math/scripts/optimize.py --game novaforged --apply           # auto-tune RTP
python math/scripts/generate_books.py --game novaforged             # RGS library
python -m pytest math/tests                                         # math tests
pnpm --filter @aetherspin/frontend dev                             # play locally
bash scripts/package-for-stake.sh novaforged                       # upload bundle
```

## Rules of the road

- **The client never decides outcomes.** All RNG/payouts are server-side. See `SECURITY.md`.
- Keep the math and frontend in lock-step **through the shared definition** — do
  not hardcode paytable/symbol values in either side.
- RTP is tuned with two decoupled knobs: a global paytable scalar and
  `features.freeSpins.winScale` (which balances the buy-bonus independently so it
  is never EV-positive for the player). Re-run `validate_rtp.py` after changes.
- High volatility means RTP only converges over large samples; CI uses a tolerance.
- Don't commit generated output: `math/library/*`, `dist-stake/`, `math/engine/`
  are git-ignored.
