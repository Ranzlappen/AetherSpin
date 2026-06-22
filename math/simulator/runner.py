"""High-level orchestration: run simulations, measure RTP, write the library."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .definition import GameDefinition, load_definition
from .engine import LinesEngine
from .library import LibraryWriter
from .reels import load_reelset
from .rng import Rng

GAME_DIR = Path(__file__).resolve().parents[1] / "games"


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


def build_engine(game_id: str) -> tuple[GameDefinition, LinesEngine]:
    definition = load_definition(game_id)
    reels_dir = GAME_DIR / game_id / "reels"
    base = load_reelset("BR0", reels_dir / "BR0.csv")
    free = load_reelset("FR0", reels_dir / "FR0.csv")
    return definition, LinesEngine(definition, base, free)


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

        for i in range(num_sims):
            rng.reseed(seed * 1_000_003 + hash(mode) % 1000 + i)
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


def write_library(game_id: str, output: SimulationOutput, library_root: Path) -> Path:
    definition = load_definition(game_id)
    writer = LibraryWriter(library_root, game_id)
    for mode in output.books:
        writer.write_mode(mode, output.books[mode], output.weights[mode], output.criteria[mode])
    writer.write_config(definition.raw, {m: s.rtp for m, s in output.stats.items()})
    writer.write_index()
    return writer.game_dir
