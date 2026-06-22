# Game Template

This is the enhanced base template for a new AetherSpin / Stake Engine game. It
mirrors the official `StakeEngine/math-sdk` `games/template` layout so a new
title can be developed against the certified SDK, while also being compatible
with the repo's standalone engine for fast local iteration.

## Files

| File | Purpose |
| --- | --- |
| `game_config.py` | Symbols, paytable, paylines, reels, bet modes, distributions. The single most important file. |
| `gamestate.py` | `run_spin()` entry point — orchestrates one simulated round. |
| `game_executables.py` | Thin orchestration steps (draw board, evaluate, emit events). |
| `game_calculations.py` | Pure win math (no side effects). |
| `game_events.py` | Book-event factories — the contract consumed by the frontend. |
| `game_override.py` | State init + per-round resets. |
| `game_optimization.py` | RTP optimizer targets/conditions. |
| `run.py` | Pipeline entry point for the official SDK. |
| `run_config.toml` | Runtime config (threads, sim counts, pipeline toggles). |
| `reels/` | `BR0.csv` (base) and `FR0.csv` (free) reel strips. |

## Creating a new game

```bash
bash scripts/new-game.sh my_new_game
```

This clones the template (and a `shared/games/<id>/game-definition.json`),
then you tune the definition and reels. See `docs/developing-a-new-game.md`.

> The flagship `games/novaforged` is the fully worked reference implementation —
> read it alongside this template.
