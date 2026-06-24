# Contributing to AetherSpin

Thanks for working on AetherSpin. This guide covers local setup, the quality
gates, and how to add a new game.

## Prerequisites

- **Node 20+** and **pnpm 10+** (`corepack enable` or see `.nvmrc`)
- **Python 3.11** (see `.python-version`)
- Optional: `pre-commit` (`pipx install pre-commit && pre-commit install`)

```bash
pnpm install                 # workspace deps (frontend + shared)
pip install -r math/requirements.txt   # math dev/test tooling (engine itself is stdlib-only)
```

## Project layout

See `REPO-OVERVIEW.md` for the full map. In short: `shared/` holds the
single-source-of-truth game definitions + contracts; `math/` is the server math
(stdlib simulator + official-SDK game files); `frontend/` is the Svelte/PixiJS
client.

## Quality gates (run before pushing)

The same checks run in CI (`.github/workflows/ci.yml`):

```bash
# Math
PYTHONHASHSEED=0 python -m pytest math/tests            # unit + property tests
( cd math && python -m mypy )                           # type-check the engine
python scripts/validate_definitions.py                  # semantic definition checks
python math/scripts/validate_rtp.py --game novaforged --sims 150000 --mode all

# Frontend
pnpm --filter @aetherspin/frontend run check            # svelte-check + tsc
pnpm --filter @aetherspin/frontend run test:coverage    # vitest + coverage thresholds
pnpm --filter @aetherspin/frontend build

# Repo-wide
pnpm exec prettier --check "**/*.{ts,svelte,js,json,md}"
```

`PYTHONHASHSEED=0` keeps simulations reproducible — always set it when generating
or validating math.

## Branching & commits

- Branch off the current default branch; use `feat/…`, `fix/…`, `docs/…` prefixes.
- Keep PRs focused; every PR must keep CI green.
- Write clear, imperative commit messages explaining the _why_.

## Changing game numbers

Never hardcode paytable/symbol/feature values in the math or the frontend — edit
`shared/games/<id>/game-definition.json` (the single source of truth) and re-run
`validate_definitions.py` + the RTP gate. Tune RTP with
`math/scripts/optimize.py` (two decoupled knobs: a paytable scalar and
`features.freeSpins.winScale`, so the buy-bonus is balanced independently and is
never EV-positive for the player).

## Adding a new game

```bash
bash scripts/new-game.sh <game_id>
# edit shared/games/<game_id>/game-definition.json + reels, then:
python math/scripts/simulate.py --game <game_id> --sims 100000
python math/scripts/optimize.py --game <game_id> --apply
```

See `docs/developing-a-new-game.md` for the full walkthrough and
`docs/IMPROVEMENT-PLAN.md` for the roadmap.

## Security

All randomness/payouts are server-side; the client never decides outcomes. See
`SECURITY.md` before touching the RGS client or math.
