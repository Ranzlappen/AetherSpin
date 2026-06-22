#!/usr/bin/env python3
"""Lightweight RTP auto-tuner for the standalone engine.

This is the local, dependency-free counterpart to the official math-sdk Rust
optimizer. It solves for two decoupled knobs — a global paytable scalar and the
free-spin ``winScale`` — so that BOTH the base-game RTP and the buy-bonus RTP
land on target. It writes the adjusted values back into the shared definition.

Usage:
    python3 math/scripts/optimize.py --game novaforged --sims 100000 --apply

Omit --apply to preview without writing.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.definition import SHARED_GAMES_DIR, load_definition  # noqa: E402
from simulator.runner import build_engine  # noqa: E402
from simulator.rng import Rng  # noqa: E402


def measure(game, sims, seed, disable_free=False, force_free=False):
    _, engine = build_engine(game)
    rng = Rng(seed)
    total = 0.0
    for i in range(sims):
        rng.reseed(seed * 1_000_003 + i)
        total += engine.play_round(i + 1, rng, disable_free=disable_free, force_free=force_free).payout_multiplier
    return total / sims


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="novaforged")
    ap.add_argument("--sims", type=int, default=100_000)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    d = load_definition(args.game)
    target = d.rtp_target

    print("Measuring reference quantities...")
    line_only = measure(args.game, args.sims, 1, disable_free=True)
    base_total = measure(args.game, args.sims, 2)
    e_free = measure(args.game, args.sims, 3, force_free=True)  # cost-1 forced free == E[free]
    free_contrib = base_total - line_only
    print(f"  base line-only : {line_only*100:.3f}%")
    print(f"  base total     : {base_total*100:.3f}%")
    print(f"  free contrib   : {free_contrib*100:.3f}%")
    print(f"  E[free]        : {e_free*100:.3f}%  (buy rtp at 100x)")

    # Solve: paytable scalar a, winScale b
    #   bonus: e_free * a * b = target  -> a*b = K
    #   base : line_only*a + free_contrib*a*b = target
    K = target / e_free
    a = (target - free_contrib * K) / line_only
    b = K / a
    print(f"\nSolution: paytable_scalar={a:.4f}  winScale_factor={b:.4f}")
    print(f"  predicted base  = {(line_only*a + free_contrib*a*b)*100:.2f}%")
    print(f"  predicted bonus = {(e_free*a*b)*100:.2f}%")

    if not args.apply:
        print("\n(dry run — pass --apply to write changes)")
        return 0

    path = Path(SHARED_GAMES_DIR) / args.game / "game-definition.json"
    raw = json.loads(path.read_text())
    for sym in raw["paytable"]:
        raw["paytable"][sym] = {k: round(v * a, 2) for k, v in raw["paytable"][sym].items()}
    cur_scale = float(raw["features"]["freeSpins"].get("winScale", 1.0))
    raw["features"]["freeSpins"]["winScale"] = round(cur_scale * b, 4)
    path.write_text(json.dumps(raw, indent=2) + "\n", encoding="utf-8")
    print(f"\nApplied to {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
