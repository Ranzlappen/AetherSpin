#!/usr/bin/env python3
"""Generate a math white paper (PAR sheet) from a game's CERTIFIED library.

Reads the optimized lookup tables (`id,weight,payout`) the Rust optimizer
produced — whose weights ARE the final certified probability distribution — plus
the books (for free-spin frequency), and writes a per-game markdown white paper:
RTP, hit frequency, free-spin frequency, win-cap frequency, max win, volatility,
and the weighted win-distribution histogram, per bet mode.

The statistics are EXACT given the certified weights (not sim-noise estimates).

Usage (after scripts/run-certification.sh <game>):
    python math/scripts/generate_white_paper.py <game> [--out docs/white-papers/<game>-white-paper.md]
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "math" / "engine" / "games"  # certified library lives under the SDK tree

# Win-multiplier buckets for the distribution histogram (lower-inclusive).
BUCKETS = [
    (0, 0, "0 (no win)"),
    (0, 1, "0–1x"),
    (1, 2, "1–2x"),
    (2, 5, "2–5x"),
    (5, 10, "5–10x"),
    (10, 20, "10–20x"),
    (20, 50, "20–50x"),
    (50, 100, "50–100x"),
    (100, 500, "100–500x"),
    (500, 1000, "500–1000x"),
    (1000, 5000, "1000–5000x"),
    (5000, float("inf"), "5000x (win cap)"),
]


def _read_lut(path: Path) -> list[tuple[int, float, float]]:
    """Return [(id, weight, payout_multiplier)]. Payout is cents/100."""
    rows = []
    with open(path, newline="") as f:
        for r in csv.reader(f):
            if len(r) < 3:
                continue
            rows.append((int(r[0]), float(r[1]), float(r[2]) / 100.0))
    return rows


def _freespin_ids(books_path: Path) -> set[int]:
    """Ids of books that trigger free spins (carry a freeSpinTrigger event)."""
    import zstandard as zstd
    from io import TextIOWrapper

    ids: set[int] = set()
    with open(books_path, "rb") as f, zstd.ZstdDecompressor().stream_reader(f) as r:
        for line in TextIOWrapper(r, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            b = json.loads(line)
            if any(e.get("type") == "freeSpinTrigger" for e in b.get("events", [])):
                ids.add(int(b["id"]))
    return ids


def _fmt_freq(p: float) -> str:
    return f"1 in {1 / p:,.0f}" if p > 0 else "—"


def mode_stats(game: str, mode: str, cost: float, wincap: float) -> dict | None:
    pub = LIB / game / "library" / "publish_files"
    lut = next(iter(sorted(pub.glob(f"lookUpTable_{mode}_*.csv"))), None)
    if lut is None:
        return None
    rows = _read_lut(lut)
    total_w = sum(w for _, w, _ in rows)
    if total_w == 0:
        return None

    # Exact weighted moments on the win multiplier.
    mean = sum(w * p for _, w, p in rows) / total_w
    var = max(0.0, sum(w * p * p for _, w, p in rows) / total_w - mean * mean)
    std = math.sqrt(var)
    hit_w = sum(w for _, w, p in rows if p > 0)
    cap_w = sum(w for _, w, p in rows if p >= wincap - 1e-9)
    max_win = max((p for _, _, p in rows), default=0.0)

    # Weighted win-distribution histogram.
    hist = []
    for lo, hi, label in BUCKETS:
        if label == "0 (no win)":
            w = sum(w for _, w, p in rows if p <= 1e-9)
        elif hi == float("inf"):
            w = sum(w for _, w, p in rows if p >= lo - 1e-9)
        else:  # positive band [lo, hi); exclude the no-win zero
            w = sum(w for _, w, p in rows if p > 1e-9 and lo - 1e-9 <= p < hi)
        hist.append((label, w / total_w))

    # Free-spin frequency (weighted) — join books to weights by id.
    fs_freq = None
    books = pub / f"books_{mode}.jsonl.zst"
    if books.exists():
        try:
            fs_ids = _freespin_ids(books)
            wmap = {}
            for i, w, _ in rows:
                wmap[i] = wmap.get(i, 0.0) + w
            fs_w = sum(wmap.get(i, 0.0) for i in fs_ids)
            fs_freq = fs_w / total_w
        except Exception:
            fs_freq = None

    return {
        "mode": mode,
        "cost": cost,
        "rtp": mean / cost,
        "hit_freq": hit_w / total_w,
        "cap_freq": cap_w / total_w,
        "fs_freq": fs_freq,
        "max_win": max_win,
        "std": std,
        "mean": mean,
        "m2m": (mean / _weighted_median(rows, total_w)) if _weighted_median(rows, total_w) > 0 else None,
        "n_outcomes": len(rows),
        "hist": hist,
    }


def _weighted_median(rows, total_w) -> float:
    half = total_w / 2.0
    acc = 0.0
    for _, w, p in sorted(rows, key=lambda r: r[2]):
        acc += w
        if acc >= half:
            return p
    return 0.0


def volatility_class(std: float, rtp: float) -> str:
    """Coarse volatility label from the coefficient of variation (std/RTP)."""
    cv = std / rtp if rtp else 0
    if cv < 5:
        return "Low"
    if cv < 12:
        return "Medium"
    if cv < 25:
        return "High"
    return "Very high"


def build(game: str) -> str:
    sys.path.insert(0, str(ROOT / "math"))
    from simulator.definition import load_definition

    d = load_definition(game)
    raw = d.raw
    eng = raw["engine"]
    fs = raw["features"]["freeSpins"]
    wincap = float(eng["wincapMultiplier"])
    target = float(eng["rtpTarget"])
    buy_cost = float(raw["features"]["bonusBuy"]["costMultiplier"])

    base = mode_stats(game, "base", 1.0, wincap)
    bonus = mode_stats(game, "bonus", buy_cost, wincap)
    if base is None:
        raise SystemExit(f"No certified library for {game}; run scripts/run-certification.sh {game} first.")

    # Provenance from the bundled/working config if present.
    cfg_path = LIB / game / "library" / "configs" / "config.json"
    prov = {}
    if cfg_path.exists():
        prov = json.load(open(cfg_path)).get("provenance", {})

    out = []
    out.append(f"# {raw['displayName']} — math white paper (PAR)")
    out.append("")
    out.append(
        f"**Game id:** `{game}` · **version** {raw['version']} · "
        f"**mechanic** {eng.get('type', '?')} · **{eng['numReels']}×{eng['numRows']}**"
    )
    out.append(
        f"**Target RTP** {target:.4f} · **win cap** {wincap:,.0f}x · "
        f"**volatility (base)** {volatility_class(base['std'], base['rtp'])}"
    )
    if prov:
        out.append(
            f"**Provenance:** commit `{str(prov.get('gitCommit', ''))[:12]}` · "
            f"definitionHash `{str(prov.get('definitionHash', ''))[:12]}` · "
            f"seed {prov.get('seed', '?')}"
        )
    out.append("")
    out.append(
        "> Certified figures: computed exactly from the Rust-optimizer's final "
        "selection weights (the published lookup tables) — not sim-noise estimates. "
        "Generated by `math/scripts/generate_white_paper.py`."
    )
    out.append("")

    # Headline table.
    out.append("## Headline metrics")
    out.append("")
    out.append("| Metric | Base | Bonus (buy) |")
    out.append("| --- | --- | --- |")

    def cell(stat, key, fmt):
        if stat is None or stat.get(key) is None:
            return "—"
        return fmt(stat[key])

    pct = lambda x: f"{x * 100:.3f}%"
    out.append(f"| Bet cost | 1.0x | {buy_cost:.0f}x |")
    out.append(f"| **RTP** | {cell(base,'rtp',lambda x:f'{x:.4f}')} | {cell(bonus,'rtp',lambda x:f'{x:.4f}')} |")
    out.append(f"| Hit frequency | {cell(base,'hit_freq',pct)} ({_fmt_freq(base['hit_freq'])}) | "
               f"{cell(bonus,'hit_freq',pct)} ({_fmt_freq(bonus['hit_freq']) if bonus else '—'}) |")
    out.append(f"| Free-spin frequency | {_fmt_freq(base['fs_freq']) if base['fs_freq'] else '—'} | "
               f"{_fmt_freq(bonus['fs_freq']) if bonus and bonus['fs_freq'] else 'n/a (bought)'} |")
    out.append(f"| Win-cap frequency | {_fmt_freq(base['cap_freq'])} | {_fmt_freq(bonus['cap_freq']) if bonus else '—'} |")
    out.append(f"| Max win | {base['max_win']:,.0f}x | {bonus['max_win']:,.0f}x |" if bonus else "")
    out.append(f"| Volatility (CV = σ/RTP) | {base['std']/base['rtp']:.1f} | "
               f"{bonus['std']/bonus['rtp']:.1f} |" if bonus else "")
    out.append(f"| Distinct outcomes | {base['n_outcomes']:,} | {bonus['n_outcomes']:,} |" if bonus else "")
    out.append("")

    # Distribution histograms.
    for stat in (base, bonus):
        if stat is None:
            continue
        out.append(f"## Win distribution — {stat['mode']} mode")
        out.append("")
        out.append("| Win range | Probability | Frequency |")
        out.append("| --- | --- | --- |")
        for label, p in stat["hist"]:
            if p <= 0:
                continue
            out.append(f"| {label} | {p * 100:.4f}% | {_fmt_freq(p)} |")
        out.append("")

    # Features + paytable context.
    out.append("## Game model")
    out.append("")
    ladder = fs["multiplierLadder"]
    out.append(f"- **Free spins:** awards {fs['awards']}, win scale ×{fs.get('winScale', 1)}, "
               f"ladder start {ladder['start']} / step {ladder['step']} / max {ladder['max']}, "
               f"retrigger {bool(fs.get('retrigger'))}.")
    mw = raw["features"]["multiplierWilds"]
    ew = raw["features"]["expandingWilds"]
    out.append(f"- **Multiplier wilds:** values {mw['values']} weights {mw['weights']} "
               f"({'enabled' if any(v > 1 for v in mw['values']) else 'disabled'}).")
    out.append(f"- **Expanding wilds:** {'enabled' if ew.get('enabled') else 'disabled'}.")
    out.append(f"- **Bonus buy:** {buy_cost:.0f}x the base bet → {raw['features']['bonusBuy']['mode']} mode.")
    out.append(f"- **Scatter:** {raw['scatter']['minToTrigger']}+ to trigger; pays {raw['scatter']['pays']}.")
    out.append("")
    out.append("## Methodology")
    out.append("")
    out.append(
        "Books are generated per forced distribution (win-cap / free-game / zero / "
        "base) and the Rust optimizer solves the per-book selection weights that hit "
        "the target RTP and volatility. The published lookup table is `id,weight,"
        "payout`; this report sums those weights directly, so every figure is the "
        "exact certified distribution. Buy-bonus RTP is measured against its "
        f"{buy_cost:.0f}x cost and is not player-EV-positive."
    )
    out.append("")
    return "\n".join(out)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("game")
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)
    text = build(args.game)
    out = args.out or str(ROOT / "docs" / "white-papers" / f"{args.game}-white-paper.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
