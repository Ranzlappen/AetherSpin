"""SDK-path orchestration guard: drive the real ``GameExecutables.run_free_spin``.

The official-SDK executables (``games/novaforged/game_executables.py``) normally
run only inside a cloned ``StakeEngine/math-sdk``. Their single hard dependency is
the SDK base class ``src.calculations.lines.Lines``; everything else (board sink,
win manager, config) is plain data. We inject a tiny stub for that one base so the
*real* ``run_free_spin``/``apply_expanding_wilds``/``_line_wins`` code runs in CI.

This is the math <-> math half of the parity guard: it pins the free-spin
behaviour that must match the standalone engine (``math/simulator/engine.py``):

  * wilds expand *before* the reveal, and the reveal carries ``expandedReels``;
  * a ``freeSpinResult`` is emitted only on a winning spin (never on an empty one).
"""

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "games" / "novaforged"))

# --- Inject a minimal stub for the one SDK base class the executables need. -----
# game_calculations.py does `from src.calculations.lines import Lines`. That is the
# ONLY SDK import on the GameExecutables path, so a no-op base is sufficient.
if "src.calculations.lines" not in sys.modules:
    src_mod = sys.modules.setdefault("src", types.ModuleType("src"))
    calc_mod = sys.modules.setdefault("src.calculations", types.ModuleType("src.calculations"))
    lines_mod = types.ModuleType("src.calculations.lines")

    class Lines:  # minimal stand-in for the SDK base
        pass

    lines_mod.Lines = Lines
    src_mod.calculations = calc_mod
    calc_mod.lines = lines_mod
    sys.modules["src.calculations.lines"] = lines_mod

from simulator.bookcontract import validate_event  # noqa: E402
from game_executables import GameExecutables  # noqa: E402


class _Cell:
    def __init__(self, name):
        self.name = name


class _Book:
    def __init__(self):
        self.events = []

    def add_event(self, evt):
        self.events.append(evt)


class _WinManager:
    def __init__(self):
        self.total = 0.0

    def update_spinwin(self, amount):
        self.total += amount


class _Config:
    """Tiny single-payline config with deterministic, known payouts."""

    num_reels = 5
    num_paylines = 1
    wild_symbol = "W"
    paylines = {0: [0, 0, 0, 0, 0]}  # top row, left to right
    symbol_paytable = {"A": {3: 10.0, 4: 20.0, 5: 50.0}}
    scatter_paytable = {3: 5.0}
    scatter_min = 3
    expanding_wilds = True
    free_win_scale = 1.0
    ladder_step = 1
    ladder_max = 10
    freespin_awards = {3: 8}


def _make_state(board):
    """A GameExecutables wired to fixed board/state for one free spin."""
    state = GameExecutables()
    state.config = _Config()
    state.scatter_symbol = "S"
    state.in_freegame = True
    state.expected_wild_multiplier = 2
    state.global_multiplier = 2
    state.fs = 0
    state.tot_fs = 8
    state.last_scatter_count = 0
    state.free_total = 0.0
    state.book = _Book()
    state.win_manager = _WinManager()
    # run_free_spin draws via create_board_reelstrips(); pin it to our board.
    state.create_board_reelstrips = lambda: ([[_Cell(n) for n in col] for col in board], [0, 0, 0, 0, 0])
    return state


def _types(events):
    return [e["type"] for e in events]


def test_winning_free_spin_expands_before_reveal_and_emits_result():
    # reel 1 (a middle reel) holds a wild that expands; top row pays A x3.
    board = [
        ["A", "x", "x"],
        ["W", "y", "z"],  # middle reel -> expands to all wild
        ["A", "x", "x"],
        ["B", "x", "x"],  # breaks the A run after 3
        ["B", "x", "x"],
    ]
    state = _make_state(board)
    state.run_free_spin()
    events = state.book.events

    # First event is the reveal, and it already shows the post-expansion board.
    assert events[0]["type"] == "reveal"
    assert events[0]["board"][1] == ["W", "W", "W"], "reveal must show expanded reel"
    assert events[0]["expandedReels"] == [1], "reveal must report expandedReels"
    assert not validate_event(events[0])

    # A winning spin emits exactly one freeSpinResult.
    assert _types(events).count("freeSpinResult") == 1
    result = next(e for e in events if e["type"] == "freeSpinResult")
    assert not validate_event(result)
    assert result["wins"], "winning spin must carry line wins"


def test_losing_free_spin_emits_no_result_and_no_expanded_reels():
    # No wild on the middle reels, no 3-in-a-row, no scatters -> empty spin.
    board = [
        ["A", "x", "x"],
        ["B", "y", "z"],
        ["A", "x", "x"],
        ["B", "x", "x"],
        ["A", "x", "x"],
    ]
    state = _make_state(board)
    state.run_free_spin()
    events = state.book.events

    assert events[0]["type"] == "reveal"
    assert "expandedReels" not in events[0], "no expansion -> field omitted"
    assert "freeSpinResult" not in _types(events), "empty spin must emit no freeSpinResult"
