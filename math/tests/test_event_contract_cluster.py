"""Contract test for the Stellar Clusters official-SDK event factories.

The cluster path (``math/games/stellarclusters/game_events.py``) must emit events
that satisfy the same shared ``BookEvent`` contract as the lines/ways paths —
closing the #1 audit risk (SDK↔frontend event drift) for the third game. These
factories are pure, so they're loaded directly (no SDK present in CI) and
validated against ``bookcontract``.
"""

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.bookcontract import validate_event  # noqa: E402


def _load_stellarclusters_events():
    """Load the stellarclusters factory module under a distinct name (the
    novaforged contract test already occupies the bare ``game_events`` name)."""
    path = ROOT / "games" / "stellarclusters" / "game_events.py"
    spec = importlib.util.spec_from_file_location("stellarclusters_game_events", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ge = _load_stellarclusters_events()


class _Cell:
    def __init__(self, name):
        self.name = name


class _FakeState:
    def __init__(self, free=False):
        self.board = [[_Cell("H1"), _Cell("W"), _Cell("S")] for _ in range(5)]
        self.reel_positions = [0, 1, 2, 3, 4]
        self.in_freegame = free
        self.global_multiplier = 1
        self.fs = 1
        self.tot_fs = 10


def _cluster_win(size=4):
    return {
        "symbol": "H1",
        "count": size,
        "wild_mult": 1,
        "amount": 2.5,
        "cells": [{"reel": r, "row": 0} for r in range(size)],
    }


def test_stellarclusters_factories_match_contract():
    wins = [_cluster_win(4)]
    events = [
        ge.reveal_event(_FakeState(free=False)),
        ge.reveal_event(_FakeState(free=True)),
        ge.cluster_wins_event(wins, 2.5, "base"),
        ge.scatter_event(3, 2.0),
        ge.freespin_trigger_event(3, 8, 1),
        ge.freespin_retrigger_event(3, 8, 16),
        ge.freespin_result_event(1, wins, {"count": 3, "amount": 2.0}, 1, 2.5),
        ge.freespin_result_event(2, [], None, 1, 0.0),
        ge.ladder_step_event(1),
        ge.freespin_end_event(12.0),
        ge.final_win_event(13.5, wincap=False),
    ]
    seen = set()
    for evt in events:
        problems = validate_event(evt)
        assert not problems, f"{evt.get('type')}: {problems}"
        seen.add(evt["type"])
    assert "clusterWins" in seen, "cluster factories must emit a clusterWins event"


def test_cluster_win_entries_carry_their_cells():
    evt = ge.cluster_wins_event([_cluster_win(5)], 2.5, "free")
    entry = evt["wins"][0]
    assert entry["count"] == 5
    assert len(entry["cells"]) == 5
    assert all("reel" in c and "row" in c for c in entry["cells"])
    assert "line" not in entry  # cluster wins have no payline index
    assert "ways" not in entry  # …and no ways count
    assert not validate_event(evt)
