#!/usr/bin/env python3
"""Validate that a game's measured RTP is within tolerance of its target.

Exits non-zero on failure so it can gate CI.

Usage:
    python3 math/scripts/validate_rtp.py --game novaforged --sims 200000 --tol 0.02
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.definition import load_definition  # noqa: E402
from simulator.runner import run_simulations  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate RTP against target")
    parser.add_argument("--game", default="novaforged")
    parser.add_argument("--sims", type=int, default=200_000)
    parser.add_argument("--tol", type=float, default=0.05, help="absolute RTP tolerance (e.g. 0.05 = 5%%). "
                        "High-volatility titles need large samples to converge; the official math-sdk "
                        "Rust optimizer tightens this for certification.")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    definition = load_definition(args.game)
    target = definition.rtp_target
    out = run_simulations(args.game, {"base": args.sims}, seed=args.seed)
    rtp = out.stats["base"].rtp

    delta = abs(rtp - target)
    ok = delta <= args.tol
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {args.game} base RTP = {rtp*100:.3f}% (target {target*100:.2f}%, "
          f"delta {delta*100:.3f}%, tol {args.tol*100:.2f}%, n={args.sims:,})")

    if not ok:
        print("RTP is outside tolerance. Adjust reel strips / paytable or run the optimizer.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
