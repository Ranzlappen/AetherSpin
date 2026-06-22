#!/usr/bin/env python3
"""Generate a PAR (Probability Accounting Report) sheet for a game.

Produces a Markdown summary of RTP, hit frequency, feature frequency, volatility
indicators and the win distribution histogram — the kind of document submitted
alongside a game for certification review.

Usage:
    python3 math/scripts/generate_par_sheet.py --game novaforged --sims 200000 --out docs/novaforged-par-sheet.md
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.definition import load_definition  # noqa: E402
from simulator.runner import build_engine  # noqa: E402
from simulator.rng import Rng  # noqa: E402

BUCKETS = [(0, 0), (0, 1), (1, 2), (2, 5), (5, 10), (10, 50), (50, 100), (100, 500), (500, 1000), (1000, 5000), (5000, float("inf"))]


def bucket_label(lo, hi):
    if lo == hi == 0:
        return "0x (no win)"
    if hi == float("inf"):
        return f">={lo}x"
    return f"{lo}x-{hi}x"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="novaforged")
    ap.add_argument("--sims", type=int, default=200_000)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    d = load_definition(args.game)
    _, engine = build_engine(args.game)
    rng = Rng(args.seed)

    total = 0.0
    wins = 0
    free = 0
    wincap = 0
    counts = Counter()
    max_win = 0.0
    for i in range(args.sims):
        rng.reseed(args.seed * 1_000_003 + i)
        r = engine.play_round(i + 1, rng)
        total += r.payout_multiplier
        if r.payout_multiplier > 0:
            wins += 1
        if r.triggered_freegame:
            free += 1
        if r.hit_wincap:
            wincap += 1
        max_win = max(max_win, r.payout_multiplier)
        for lo, hi in BUCKETS:
            if (lo == hi == 0 and r.payout_multiplier == 0) or (lo < r.payout_multiplier <= hi if hi != float("inf") else r.payout_multiplier >= lo and lo > 0):
                counts[(lo, hi)] += 1
                break

    rtp = total / args.sims
    lines = []
    lines.append(f"# PAR Sheet — {d.raw['displayName']} v{d.raw['version']}\n")
    lines.append(f"_Generated from {args.sims:,} simulated base-game rounds (standalone engine, seed {args.seed})._\n")
    lines.append("> NOTE: This is an engineering estimate. Certified figures come from the\n")
    lines.append("> official math-sdk pipeline (millions of spins + Rust optimizer).\n")
    lines.append("\n## Headline metrics\n")
    lines.append("| Metric | Value |")
    lines.append("| --- | --- |")
    lines.append(f"| Target RTP | {d.rtp_target*100:.2f}% |")
    lines.append(f"| Measured RTP | {rtp*100:.3f}% |")
    lines.append(f"| Hit frequency | {wins/args.sims*100:.2f}% (1 in {args.sims/max(wins,1):.2f}) |")
    lines.append(f"| Free-spin frequency | {free/args.sims*100:.3f}% (1 in {args.sims/max(free,1):.0f}) |")
    lines.append(f"| Max win cap | {d.wincap:,.0f}x |")
    lines.append(f"| Max win observed | {max_win:,.2f}x |")
    lines.append(f"| Wincap frequency | {wincap/args.sims*100:.4f}% |")
    lines.append(f"| Volatility | {d.raw['engine']['volatility']} |")
    lines.append("\n## Win distribution\n")
    lines.append("| Win band | Count | Probability |")
    lines.append("| --- | --- | --- |")
    for lo, hi in BUCKETS:
        c = counts[(lo, hi)]
        if c:
            lines.append(f"| {bucket_label(lo, hi)} | {c:,} | {c/args.sims*100:.4f}% |")
    report = "\n".join(lines) + "\n"

    if args.out:
        Path(args.out).write_text(report, encoding="utf-8")
        print(f"PAR sheet written to {args.out}")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
