# AetherSpin Math Engine

This package holds the server-side, certifiable game math. It offers **two
interchangeable paths** that share one source of truth
(`shared/games/<game>/game-definition.json`):

| Path | Location | Use it for |
| --- | --- | --- |
| **Standalone engine** | `math/simulator/` | Fast local dev, CI, RTP reporting, and generating RGS-compatible books — **stdlib only, no install**. |
| **Official math-sdk** | `math/games/<game>/` (+ `scripts/setup-math.sh`) | Certified simulation, the Rust optimizer, and final submission. |

## Quickstart (standalone — no dependencies)

```bash
# Simulate and print RTP / hit-rate / feature stats
python math/scripts/simulate.py --game novaforged --sims 100000

# Validate RTP against the target (gates CI)
python math/scripts/validate_rtp.py --game novaforged --sims 200000 --tol 0.03

# Auto-tune the paytable scalar + free-spin winScale to hit RTP targets
python math/scripts/optimize.py --game novaforged --sims 100000 --apply

# Generate the full RGS library (books, lookup tables, configs, index)
python math/scripts/generate_books.py --game novaforged --sims 100000

# Produce a PAR sheet
python math/scripts/generate_par_sheet.py --game novaforged --sims 200000 --out docs/novaforged-par-sheet.md

# Run the unit tests
python -m pytest math/tests
```

Output is written to `math/library/<game>/`:

```
library/novaforged/
  books/books_base.jsonl              # one JSON book per line
  books/books_bonus.jsonl
  lookup_tables/lookUpTable_base.csv          # id,weight,payout(book units)
  lookup_tables/lookUpTableIdToCriteria_base.csv
  configs/config.json                 # RGS math config (modes, costs, measured RTP)
  index.json                          # manifest
```

## Official math-sdk path

```bash
bash scripts/setup-math.sh                 # clones StakeEngine/math-sdk into math/engine/
cd math/engine && python games/novaforged/run.py
```

The game files in `math/games/novaforged/` (`game_config.py`, `gamestate.py`,
`game_executables.py`, `game_calculations.py`, `game_events.py`,
`game_override.py`, `game_optimization.py`, `run.py`, `run_config.toml`) are
written against the official SDK API and read the same shared definition, so the
two paths stay in lock-step.

See `docs/math-engine.md` for the deep dive and `math/games/template/` to start a
new game.
