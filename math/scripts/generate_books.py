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

from simulator.bookcontract import validate_book  # noqa: E402
from simulator.definition import load_definition  # noqa: E402
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

    # Fail closed: never write a library containing a malformed/over-cap book.
    wincap = load_definition(args.game).wincap
    problems: list[str] = []
    for mode, books in out.books.items():
        for book in books:
            for p in validate_book(book, wincap=wincap):
                problems.append(f"[{mode}] id={book.get('id')}: {p}")
    if problems:
        print(f"ERROR: {len(problems)} book-integrity problem(s); refusing to write library:")
        for p in problems[:20]:
            print(f"  - {p}")
        return 1

    game_dir = write_library(args.game, out, Path(args.out), seed=args.seed)

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
