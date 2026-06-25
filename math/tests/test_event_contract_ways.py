"""Contract test for the Cosmic Ways official-SDK event factories.

The ways path (``math/games/cosmicways/game_events.py``) must emit events that
satisfy the same shared ``BookEvent`` contract as the lines path — closing the
#1 audit risk (SDK↔frontend event drift) for the second game. These factories
are pure, so they're loaded directly (no SDK present in CI) and validated against
``bookcontract``.
"""

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.bookcontract import validate_event  # noqa: E402


def _load_cosmicways_events():
    """Load the cosmicways factory module under a distinct name (the novaforged
    contract test already occupies the bare ``game_events`` module name)."""
    path = ROOT / "games" / "cosmicways" / "game_events.py"
    spec = importlib.util.spec_from_file_location("cosmicways_game_events", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ge = _load_cosmicways_events()


class _Cell:
    def __init__(self, name):
        self.name = name


class _FakeState:
    def __init__(self, free=False):
        self.board = [[_Cell("L1"), _Cell("W"), _Cell("S")] for _ in range(5)]
        self.reel_positions = [0, 1, 2, 3, 4]
        self.in_freegame = free
        self.global_multiplier = 1
        self.fs = 1
        self.tot_fs = 10


def test_cosmicways_factories_match_contract():
    wins = [{"symbol": "H1", "count": 3, "ways": 8, "wild_mult": 1, "amount": 1.5}]
    events = [
        ge.reveal_event(_FakeState(free=False)),
        ge.reveal_event(_FakeState(free=True)),
        ge.way_wins_event(wins, 1.5, "base"),
        ge.scatter_event(3, 2.0),
        ge.freespin_trigger_event(3, 8, 1),
        ge.freespin_retrigger_event(3, 8, 16),
        ge.freespin_result_event(1, wins, {"count": 3, "amount": 2.0}, 1, 1.5),
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
    assert "wayWins" in seen, "ways factories must emit a wayWins event"


def test_way_win_entries_carry_the_ways_count():
    evt = ge.way_wins_event(
        [{"symbol": "H2", "count": 4, "ways": 12, "wildMultiplier": 2, "amount": 3.0}], 3.0, "free"
    )
    entry = evt["wins"][0]
    assert entry["ways"] == 12
    assert entry["count"] == 4
    assert entry["wildMultiplier"] == 2
    assert "line" not in entry  # ways wins have no payline index
    assert not validate_event(evt)
