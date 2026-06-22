#!/usr/bin/env python3
"""Run a Monte-Carlo simulation for a game and print summary statistics.

Usage:
    python3 math/scripts/simulate.py --game novaforged --sims 100000
    python3 math/scripts/simulate.py --game novaforged --mode base --sims 50000
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "simulator"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from simulator.runner import run_simulations  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="AetherSpin math simulator")
    parser.add_argument("--game", default="novaforged")
    parser.add_argument("--sims", type=int, default=100_000, help="sims per mode")
    parser.add_argument("--mode", default="all", help="base | bonus | all")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if args.mode == "all":
        num_by_mode = {"base": args.sims, "bonus": max(1, args.sims // 5)}
    else:
        num_by_mode = {args.mode: args.sims}

    def progress(mode: str, done: int, total: int) -> None:
        print(f"  [{mode}] {done:,}/{total:,}", end="\r", flush=True)

    print(f"Simulating '{args.game}' :: {num_by_mode}")
    start = time.time()
    out = run_simulations(args.game, num_by_mode, seed=args.seed, progress=progress)
    elapsed = time.time() - start
    print(" " * 40, end="\r")

    print(f"\nResults for '{args.game}' (seed={args.seed}, {elapsed:.1f}s):")
    print("-" * 72)
    for mode, s in out.stats.items():
        print(f"  Mode: {mode}")
        print(f"    RTP            : {s.rtp * 100:.3f}%")
        print(f"    Hit rate       : {s.hit_rate * 100:.2f}%")
        print(f"    Free-game rate : {s.freegame_rate * 100:.3f}%  (1 in {1/s.freegame_rate:,.0f})" if s.freegame_rate else "    Free-game rate : 0%")
        print(f"    Wincap rate    : {s.wincap_rate * 100:.4f}%")
        print(f"    Max win        : {s.max_win:,.2f}x")
        print(f"    Avg win|win    : {s.mean_win:,.3f}x")
        print("-" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
