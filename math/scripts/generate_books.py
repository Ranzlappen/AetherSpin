#!/usr/bin/env python3
"""Run simulations and write the full RGS-compatible library to math/library/.

Usage:
    python3 math/scripts/generate_books.py --game novaforged --sims 100000
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.runner import run_simulations, write_library  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate RGS library output")
    parser.add_argument("--game", default="novaforged")
    parser.add_argument("--sims", type=int, default=100_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default=str(ROOT / "library"))
    args = parser.parse_args()

    num_by_mode = {"base": args.sims, "bonus": max(1, args.sims // 5)}
    print(f"Generating books for '{args.game}' :: {num_by_mode}")
    out = run_simulations(args.game, num_by_mode, seed=args.seed)
    game_dir = write_library(args.game, out, Path(args.out))

    print(f"\nLibrary written to: {game_dir}")
    for mode, s in out.stats.items():
        print(f"  {mode}: {s.num_sims:,} books, RTP {s.rtp*100:.3f}%")
    print("\nFiles:")
    for p in sorted(game_dir.rglob("*")):
        if p.is_file():
            print(f"  {p.relative_to(game_dir.parent)}  ({p.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
