"""High-level orchestration: run simulations, measure RTP, write the library."""

from __future__ import annotations

import zlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .definition import GameDefinition, load_definition
from .engine import SlotEngine
from .library import LibraryWriter
from .reels import load_reelset
from .rng import Rng

GAME_DIR = Path(__file__).resolve().parents[1] / "games"
SIMULATOR_VERSION = "1.0.0"

# Stable per-mode seed offsets. Using a fixed map (with a deterministic
# crc32-based fallback) keeps simulations reproducible across processes and
# machines — unlike the built-in ``hash()``, which is salted per process unless
# PYTHONHASHSEED is pinned. Reproducible libraries are a certification expectation.
MODE_SEED_OFFSET = {"base": 101, "bonus": 202}


def mode_seed_offset(mode: str) -> int:
    if mode in MODE_SEED_OFFSET:
        return MODE_SEED_OFFSET[mode]
    return zlib.crc32(mode.encode("utf-8")) % 1000


@dataclass
class ModeStats:
    mode: str
    num_sims: int
    rtp: float
    hit_rate: float
    freegame_rate: float
    wincap_rate: float
    max_win: float
    mean_win: float


@dataclass
class SimulationOutput:
    stats: dict[str, ModeStats]
    books: dict[str, list[dict[str, Any]]]
    weights: dict[str, list[int]]
    criteria: dict[str, list[str]]


def build_engine(game_id: str) -> tuple[GameDefinition, SlotEngine]:
    definition = load_definition(game_id)
    reels_dir = GAME_DIR / game_id / "reels"
    base = load_reelset("BR0", reels_dir / "BR0.csv")
    free = load_reelset("FR0", reels_dir / "FR0.csv")
    return definition, SlotEngine(definition, base, free)


def run_simulations(
    game_id: str,
    num_sims_by_mode: dict[str, int],
    seed: int = 0,
    progress: Callable[[str, int, int], None] | None = None,
) -> SimulationOutput:
    definition, engine = build_engine(game_id)
    rng = Rng(seed)

    stats: dict[str, ModeStats] = {}
    books_by_mode: dict[str, list[dict[str, Any]]] = {}
    weights_by_mode: dict[str, list[int]] = {}
    criteria_by_mode: dict[str, list[str]] = {}

    bonus_cost = next((m["cost"] for m in definition.bet_modes if m.get("isBuyBonus")), 100.0)

    for mode, num_sims in num_sims_by_mode.items():
        is_buy = any(m["name"] == mode and m.get("isBuyBonus") for m in definition.bet_modes)
        cost = bonus_cost if is_buy else 1.0

        books: list[dict[str, Any]] = []
        weights: list[int] = []
        criteria: list[str] = []
        total_payout = 0.0
        wins = 0
        freegames = 0
        wincaps = 0
        max_win = 0.0

        offset = mode_seed_offset(mode)
        for i in range(num_sims):
            rng.reseed(seed * 1_000_003 + offset + i)
            result = engine.play_round(i + 1, rng, force_free=is_buy)
            # For buy-bonus the payout is measured against the higher cost.
            payout = result.payout_multiplier / cost if is_buy else result.payout_multiplier
            total_payout += payout
            if result.payout_multiplier > 0:
                wins += 1
            if result.triggered_freegame:
                freegames += 1
            if result.hit_wincap:
                wincaps += 1
            max_win = max(max_win, result.payout_multiplier)

            books.append({"id": i + 1, "payoutMultiplier": result.payout_multiplier, "events": result.events})
            weights.append(1)
            criteria.append(self_criteria(result))

            if progress and (i + 1) % 10000 == 0:
                progress(mode, i + 1, num_sims)

        rtp = total_payout / num_sims if num_sims else 0.0
        stats[mode] = ModeStats(
            mode=mode,
            num_sims=num_sims,
            rtp=rtp,
            hit_rate=wins / num_sims if num_sims else 0.0,
            freegame_rate=freegames / num_sims if num_sims else 0.0,
            wincap_rate=wincaps / num_sims if num_sims else 0.0,
            max_win=max_win,
            mean_win=total_payout / wins if wins else 0.0,
        )
        books_by_mode[mode] = books
        weights_by_mode[mode] = weights
        criteria_by_mode[mode] = criteria

    return SimulationOutput(stats=stats, books=books_by_mode, weights=weights_by_mode, criteria=criteria_by_mode)


def self_criteria(result) -> str:
    if result.hit_wincap:
        return "wincap"
    if result.triggered_freegame:
        return "freegame"
    if result.payout_multiplier > 0:
        return "basegame"
    return "0"


def _file_sha256(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()


def _git_commit() -> str:
    """Best-effort source revision that produced this library.

    Prefers ``GITHUB_SHA`` (set in CI) so the stamp is correct even when the
    working tree is a shallow/detached checkout; otherwise falls back to a local
    ``git rev-parse``. Returns ``"unknown"`` when neither is available (e.g. a
    source tarball with no VCS), which keeps generation working off-VCS.
    """
    import os
    import subprocess

    env_sha = os.environ.get("GITHUB_SHA")
    if env_sha:
        return env_sha
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(Path(__file__).resolve().parent),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return "unknown"


def build_provenance(game_id: str, definition: GameDefinition, seed: int) -> dict[str, Any]:
    """Reproducibility metadata embedded in the generated config.json.

    Auditors expect to be able to regenerate a byte-identical library from a
    commit + seed; this records exactly what produced these books.
    """
    import hashlib
    import json as _json
    from datetime import datetime, timezone

    canonical = _json.dumps(definition.raw, sort_keys=True, separators=(",", ":")).encode("utf-8")
    reels_dir = GAME_DIR / game_id / "reels"
    reel_hashes = {}
    if reels_dir.is_dir():
        for csv_path in sorted(reels_dir.glob("*.csv")):
            reel_hashes[csv_path.name] = _file_sha256(csv_path)
    return {
        "seed": seed,
        "gitCommit": _git_commit(),
        "definitionHash": hashlib.sha256(canonical).hexdigest(),
        "reelHashes": reel_hashes,
        "simulatorVersion": SIMULATOR_VERSION,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pythonHashSeedPinned": True,
    }


def write_library(game_id: str, output: SimulationOutput, library_root: Path, seed: int = 0) -> Path:
    definition = load_definition(game_id)
    writer = LibraryWriter(library_root, game_id)
    for mode in output.books:
        writer.write_mode(mode, output.books[mode], output.weights[mode], output.criteria[mode])
    provenance = build_provenance(game_id, definition, seed)
    writer.write_config(definition.raw, {m: s.rtp for m, s in output.stats.items()}, provenance=provenance)
    writer.write_index()
    return writer.game_dir
