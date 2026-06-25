"""Tests for the pluggable win-mechanic seam."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

MATH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MATH_ROOT / "simulator"))
sys.path.insert(0, str(MATH_ROOT))

from simulator.bookcontract import validate_book  # noqa: E402
from simulator.definition import load_definition  # noqa: E402
from simulator.mechanics import (  # noqa: E402
    ClusterMechanic,
    LinesMechanic,
    WaysMechanic,
    WinMechanic,
    build_mechanic,
    register_mechanic,
)
from simulator.rng import Rng  # noqa: E402
from simulator.runner import build_engine  # noqa: E402


def test_build_mechanic_resolves_lines_for_novaforged() -> None:
    definition = load_definition("novaforged")
    assert definition.engine_type == "lines"
    mechanic = build_mechanic(definition)
    assert isinstance(mechanic, LinesMechanic)
    assert mechanic.win_event_type == "lineWins"


def test_build_mechanic_raises_for_unknown_type() -> None:
    definition = load_definition("novaforged")
    definition.raw["engine"]["type"] = "does-not-exist"
    with pytest.raises(ValueError, match="unknown engine mechanic"):
        build_mechanic(definition)


def test_registry_is_extensible() -> None:
    class DummyMechanic(WinMechanic):
        win_event_type = "dummyWins"

        def __init__(self, definition) -> None:  # noqa: D401
            self.d = definition

        def evaluate(self, board, mult_grid):
            return 0.0, []

    register_mechanic("dummy", DummyMechanic)
    definition = load_definition("novaforged")
    definition.raw["engine"]["type"] = "dummy"
    mechanic = build_mechanic(definition)
    assert isinstance(mechanic, DummyMechanic)
    assert mechanic.evaluate([], None) == (0.0, [])


def test_ways_mechanic_counts_ways_as_product_of_per_reel_occurrences() -> None:
    definition = load_definition("cosmicways")
    assert definition.engine_type == "ways"
    mechanic = build_mechanic(definition)
    assert isinstance(mechanic, WaysMechanic)

    # Pick a paying symbol that is neither wild nor scatter; fill with scatters
    # so only the target symbol forms a left-aligned run.
    target = next(s for s in definition.paytable if s not in (definition.wild, definition.scatter))
    fill = definition.scatter
    # 5×3 board, columns top→bottom. Target occurs 2× on reel0, 1× on reels 1–2,
    # then absent → run length 3, ways = 2 × 1 × 1 = 2.
    board = [
        [target, target, fill],
        [target, fill, fill],
        [target, fill, fill],
        [fill, fill, fill],
        [fill, fill, fill],
    ]
    _total, wins = mechanic.evaluate(board, mult_grid=None)
    win = next(w for w in wins if w["symbol"] == target)
    assert win["count"] == 3
    assert win["ways"] == 2
    assert win["wildMultiplier"] == 1


def test_cosmicways_simulates_to_valid_books() -> None:
    """The second game runs end-to-end through the shared engine + book contract."""
    definition = load_definition("cosmicways")
    _, engine = build_engine("cosmicways")
    rng = Rng(0)
    for i in range(2000):
        rng.reseed(i)
        result = engine.play_round(i + 1, rng)
        book = {"id": i + 1, "payoutMultiplier": result.payout_multiplier, "events": result.events}
        assert not validate_book(book, wincap=definition.wincap), f"sim {i}"


def test_cluster_mechanic_pays_connected_groups() -> None:
    definition = load_definition("stellarclusters")
    assert definition.engine_type == "cluster"
    mechanic = build_mechanic(definition)
    assert isinstance(mechanic, ClusterMechanic)

    target = next(s for s in definition.paytable if s not in (definition.wild, definition.scatter))
    fill = definition.scatter  # breaks adjacency for every other symbol
    # 5 reels x 3 rows; a connected 2x2 block of `target` on reels 0-1 = size 4.
    board = [
        [target, target, fill],
        [target, target, fill],
        [fill, fill, fill],
        [fill, fill, fill],
        [fill, fill, fill],
    ]
    _total, wins = mechanic.evaluate(board, mult_grid=None)
    win = next(w for w in wins if w["symbol"] == target)
    assert win["count"] == 4
    assert len(win["cells"]) == 4
    assert win["wildMultiplier"] == 1


def test_cluster_mechanic_ignores_groups_below_three() -> None:
    definition = load_definition("stellarclusters")
    mechanic = build_mechanic(definition)
    target = next(s for s in definition.paytable if s not in (definition.wild, definition.scatter))
    fill = definition.scatter
    # Only a pair of `target` (size 2) — no payout.
    board = [[target, target, fill]] + [[fill, fill, fill] for _ in range(4)]
    _total, wins = mechanic.evaluate(board, mult_grid=None)
    assert not any(w["symbol"] == target for w in wins)


def test_stellarclusters_simulates_to_valid_books() -> None:
    definition = load_definition("stellarclusters")
    _, engine = build_engine("stellarclusters")
    rng = Rng(0)
    for i in range(2000):
        rng.reseed(i)
        result = engine.play_round(i + 1, rng)
        book = {"id": i + 1, "payoutMultiplier": result.payout_multiplier, "events": result.events}
        assert not validate_book(book, wincap=definition.wincap), f"sim {i}"
