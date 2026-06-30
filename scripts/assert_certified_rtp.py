#!/usr/bin/env python3
"""Assert a game's CERTIFIED (Rust-optimized) library converged to target RTP.

Reads the optimized lookup tables the optimizer produced under
`math/engine/games/<game>/library/publish_files/lookUpTable_<mode>_*.csv`
(`id,weight,payout` where payout is cents/100) and checks, per bet mode, that the
weighted RTP matches the game's target. Targets/costs come straight from the
shared `game-definition.json`, so this needs no SDK import.

Convergence rules (tolerance `--tol`, default 0.03):
  * base  : |rtp - rtpTarget| <= tol
  * bonus : rtp <= rtpTarget + tol   (compliance bound — never player-EV-positive)

A game with NO optimized library is treated as SKIPPED (the certification run is
fail-soft and SKIPs where the toolchain/SDK is absent), not a failure. Exits
non-zero only when a library exists but a mode is off-target.

Usage:
    python3.12 scripts/assert_certified_rtp.py [--tol 0.03] <game> [<game> ...]
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _definition(game: str) -> dict:
    with open(ROOT / "shared" / "games" / game / "game-definition.json") as f:
        return json.load(f)


def _lut_rtp(game: str, mode: str, cost: float) -> float | None:
    """Weighted RTP from the optimized LUT, or None if no library exists."""
    pattern = str(
        ROOT / "math" / "engine" / "games" / game / "library" / "publish_files" / f"lookUpTable_{mode}_*.csv"
    )
    hits = sorted(glob.glob(pattern))
    if not hits:
        return None
    wsum = psum = 0.0
    with open(hits[0], newline="") as f:
        for r in csv.reader(f):
            if len(r) < 3:
                continue
            w = float(r[1])
            p = float(r[2]) / 100.0
            wsum += w
            psum += w * p
    return (psum / wsum / cost) if wsum else 0.0


def check_game(game: str, tol: float) -> tuple[bool, bool]:
    """Return (ok, ran). ran=False means no library (skipped)."""
    d = _definition(game)
    target = float(d["engine"]["rtpTarget"])
    buy_cost = float(d["features"]["bonusBuy"]["costMultiplier"])

    base = _lut_rtp(game, "base", 1.0)
    bonus = _lut_rtp(game, "bonus", buy_cost)
    if base is None and bonus is None:
        print(f"  [{game}] SKIP — no optimized library (certification not run here)")
        return True, False

    ok = True
    if base is not None:
        good = abs(base - target) <= tol
        ok &= good
        print(f"  [{game}] base  RTP={base:.4f} target={target:.4f} tol={tol}  {'OK' if good else 'FAIL'}")
    if bonus is not None:
        good = bonus <= target + tol  # compliance bound, not |·|
        ok &= good
        print(
            f"  [{game}] bonus RTP={bonus:.4f} bound<= {target + tol:.4f} (cost {buy_cost:g}x)  "
            f"{'OK' if good else 'FAIL'}"
        )
    return ok, True


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("games", nargs="+")
    ap.add_argument("--tol", type=float, default=0.03)
    args = ap.parse_args(argv)

    all_ok = True
    any_ran = False
    print("=== certified RTP convergence ===")
    for game in args.games:
        if game == "template" or not (ROOT / "shared" / "games" / game / "game-definition.json").exists():
            continue
        ok, ran = check_game(game, args.tol)
        all_ok &= ok
        any_ran |= ran

    if not any_ran:
        print("No certified libraries found — nothing asserted (certification was skipped).")
        return 0
    if not all_ok:
        print("FAIL: at least one certified library is off-target.")
        return 1
    print("All certified libraries converged within tolerance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
