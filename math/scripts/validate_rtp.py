#!/usr/bin/env python3
"""Validate a game's measured RTP against its target — for BOTH bet modes.

- base mode must be within ``--tol`` of the RTP target.
- buy-bonus mode must be at or below ``target + --tol`` (it must never be
  EV-positive for the player; see SECURITY.md).

Exits non-zero on any failure so it can gate CI.

Usage:
    python3 math/scripts/validate_rtp.py --game novaforged --sims 200000 --mode all
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


def bonus_upper_bound(target: float, tol: float) -> float:
    """Upper RTP bound the buy-bonus mode must satisfy.

    The buy-bonus must never be EV-positive for the player (see SECURITY.md), so
    the bound is clamped at break-even (1.0) even when ``target + tol`` would
    exceed it. The tolerance only absorbs sampling noise *below* break-even; it
    never licenses an EV-positive buy.
    """
    return min(target + tol, 1.0)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate RTP against target (base + buy-bonus)")
    parser.add_argument("--game", default="novaforged")
    parser.add_argument("--sims", type=int, default=200_000, help="sims for the base mode")
    parser.add_argument("--tol", type=float, default=0.05, help="absolute RTP tolerance (e.g. 0.05 = 5%%). "
                        "High-volatility titles need large samples to converge; the official math-sdk "
                        "Rust optimizer tightens this for certification.")
    parser.add_argument("--mode", choices=["base", "bonus", "all"], default="all")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    definition = load_definition(args.game)
    target = definition.rtp_target
    failures = 0

    if args.mode in ("base", "all"):
        out = run_simulations(args.game, {"base": args.sims}, seed=args.seed)
        rtp = out.stats["base"].rtp
        delta = abs(rtp - target)
        ok = delta <= args.tol
        failures += 0 if ok else 1
        print(f"[{'PASS' if ok else 'FAIL'}] {args.game} base RTP = {rtp*100:.3f}% "
              f"(target {target*100:.2f}%, delta {delta*100:.3f}%, tol {args.tol*100:.2f}%, n={args.sims:,})")
        if not ok:
            print("  base RTP outside tolerance. Adjust reels/paytable or run optimize.py.")

    if args.mode in ("bonus", "all"):
        # Bonus converges per-trigger, so a smaller sample is plenty; cap it for speed.
        bonus_sims = min(args.sims, 50_000)
        out = run_simulations(args.game, {"bonus": bonus_sims}, seed=args.seed)
        rtp = out.stats["bonus"].rtp
        upper = bonus_upper_bound(target, args.tol)
        ok = rtp <= upper
        failures += 0 if ok else 1
        print(f"[{'PASS' if ok else 'FAIL'}] {args.game} buy-bonus RTP = {rtp*100:.3f}% "
              f"(must be <= min(target+tol, 100%) = {upper*100:.2f}%, n={bonus_sims:,})")
        if not ok:
            print("  buy-bonus is EV-positive / non-compliant. Lower features.freeSpins.winScale.")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
