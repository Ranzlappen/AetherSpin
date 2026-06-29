"""Hermetic contract test for every game's official-SDK event factories.

Each game's `math/games/<id>/game_events.py` emits the shared `BookEvent`
vocabulary (`shared/src/types/events.ts`) by appending dicts to `gamestate.book`.
This test drives those factories with a minimal fake gamestate — no SDK present —
and asserts every emitted event satisfies the contract, plus that the base-game
win event is the mechanic's expected type (lineWins/wayWins/clusterWins). It is
the CI-runnable half of the SDK book-contract guard (the end-to-end half,
`test_sdk_book_contract.py`, runs the real SDK when vendored).
"""

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))

from simulator.bookcontract import validate_event  # noqa: E402

GAMES = {
    "novaforged": "lineWins",
    "cosmicways": "wayWins",
    "stellarclusters": "clusterWins",
}


def _load_events(game: str):
    """Load a game's game_events.py under a unique module name (all three share
    the bare module name `game_events`)."""
    path = ROOT / "games" / game / "game_events.py"
    spec = importlib.util.spec_from_file_location(f"{game}_game_events", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Cell:
    def __init__(self, name, wild=False, mult=1):
        self.name = name
        self._wild = wild
        self.multiplier = mult

    def check_attribute(self, attr):
        return self._wild if attr == "wild" else False


class _Book:
    def __init__(self):
        self.events = []

    def add_event(self, event):
        self.events.append(event)


class _Config:
    basegame_type = "basegame"
    freegame_type = "freegame"
    wincap = 5000.0

    def __init__(self, win_event):
        self.contract_win_event = win_event


class _WinManager:
    spin_win = 2.0
    running_bet_win = 2.0


class _State:
    def __init__(self, win_event):
        self.config = _Config(win_event)
        # A wild with a realized multiplier (3) and a scatter, to exercise the
        # multiplierWilds payload on a free reveal.
        self.board = [[_Cell("L1"), _Cell("W", wild=True, mult=3), _Cell("S")] for _ in range(5)]
        self.reel_positions = [0, 1, 2, 3, 4]
        self.expanding_wild_reels = [1, 2]
        self.global_multiplier = 2
        self.contract_wins = [{"symbol": "H1", "count": 3, "wildMultiplier": 1, "amount": 1.5}]
        self.contract_win_total = 1.5
        self.contract_scatter = {"count": 3, "amount": 2.0}
        self.win_manager = _WinManager()
        self.final_win = 3.5
        self.book = _Book()


@pytest.mark.parametrize("game,win_type", GAMES.items())
def test_factories_emit_contract_conformant_events(game, win_type):
    ev = _load_events(game)
    s = _State(win_type)

    ev.reveal_event(s, s.config.basegame_type)
    ev.reveal_event(s, s.config.freegame_type, spin=1, spins_total=10)
    ev.win_event(s, s.config.basegame_type)
    ev.scatter_win_event(s)
    ev.free_spin_trigger_event(s, 3, 8, 1)
    ev.free_spin_result_event(s, 1)
    ev.ladder_step_event(s)
    ev.free_spin_retrigger_event(s, 3, 8, 16)
    ev.free_spin_end_event(s, 12.0)
    ev.final_win_event(s)

    seen = set()
    for event in s.book.events:
        problems = validate_event(event)
        assert not problems, f"{game}/{event.get('type')}: {problems}"
        seen.add(event["type"])

    # The base-game win event must be the mechanic's contract type.
    assert win_type in seen, f"{game}: expected a {win_type} event"
    # Free reveal must carry the realized multiplier wild + expanded reels.
    free_reveal = next(
        e for e in s.book.events if e["type"] == "reveal" and e["gameType"] == "free"
    )
    assert free_reveal["multiplierWilds"] == [{"reel": r, "row": 1, "value": 3} for r in range(5)]
    assert free_reveal["expandedReels"] == [1, 2]


def test_gametype_is_mapped_to_contract_values():
    """Internal SDK gametypes ("basegame"/"freegame") map to the contract's
    "base"/"free"."""
    ev = _load_events("novaforged")
    s = _State("lineWins")
    ev.reveal_event(s, s.config.basegame_type)
    ev.reveal_event(s, s.config.freegame_type, spin=1, spins_total=5)
    gametypes = [e["gameType"] for e in s.book.events]
    assert gametypes == ["base", "free"]
