"""Contract tests: the math output must conform to the BookEvent vocabulary.

Three guards:
1. The official-SDK-path event factories (``games/novaforged/game_events.py``,
   which are pure) emit dicts that satisfy the shared contract.
2. Every event the standalone engine emits over many seeds is a valid BookEvent,
   and every book is well-formed (ordering, wincap, required fields).
3. The SDK ``run_free_spin`` orchestration (``test_sdk_executables.py``) is driven
   over a tiny stubbed SDK base so the two math engines are checked for the same
   free-spin behaviour (expand-before-reveal, ``expandedReels``, and a
   ``freeSpinResult`` only on a winning spin) — catching math <-> math drift, not
   just math <-> contract conformance.

Together these make the math <-> frontend event drift (the #1 audit risk) a test
failure, not a silent production bug.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "games" / "novaforged"))

from simulator.bookcontract import VALID_EVENT_TYPES, validate_book, validate_event  # noqa: E402
from simulator.definition import load_definition  # noqa: E402
from simulator.runner import build_engine  # noqa: E402
from simulator.rng import Rng  # noqa: E402

import game_events as ge  # noqa: E402  (pure factory module, no SDK imports)


class _Cell:
    def __init__(self, name):
        self.name = name


class _FakeState:
    """Minimal stand-in for the SDK game state, enough for reveal_event."""

    def __init__(self, free=False):
        self.board = [[_Cell("L1"), _Cell("W"), _Cell("S")] for _ in range(5)]
        self.reel_positions = [0, 1, 2, 3, 4]
        self.in_freegame = free
        self.global_multiplier = 2
        self.fs = 1
        self.tot_fs = 8


def test_sdk_factories_match_contract():
    wins = [{"line": 0, "symbol": "H1", "count": 3, "wild_mult": 2, "amount": 1.5}]
    events = [
        ge.reveal_event(_FakeState(free=False)),
        ge.reveal_event(_FakeState(free=True)),
        ge.line_wins_event(wins, 1.5, "base"),
        ge.scatter_event(3, 2.0),
        ge.freespin_trigger_event(3, 8, 1),
        ge.freespin_retrigger_event(3, 8, 16),
        ge.freespin_result_event(1, wins, {"count": 3, "amount": 2.0}, 2, 4.0),
        ge.freespin_result_event(2, [], None, 3, 0.0),
        ge.ladder_step_event(2),
        ge.freespin_end_event(12.0),
        ge.final_win_event(13.5, wincap=False),
    ]
    seen = set()
    for evt in events:
        problems = validate_event(evt)
        assert not problems, f"{evt.get('type')}: {problems}"
        seen.add(evt["type"])
    # The lines factories must cover every contract event type except those that
    # belong to other mechanics (``wayWins``/``clusterWins`` are emitted by the
    # ways/cluster games).
    lines_event_types = VALID_EVENT_TYPES - {"wayWins", "clusterWins"}
    assert seen == lines_event_types, f"factories miss types: {lines_event_types - seen}"


def test_freespin_reveal_carries_expanded_reels():
    """A free-game reveal reports ``expandedReels`` (parity with the standalone
    engine); the base reveal never does, and an un-expanded spin omits the field
    rather than emitting an empty list."""
    base = ge.reveal_event(_FakeState(free=False), expanded_reels=[1, 2])
    assert "expandedReels" not in base  # base game has no expanding wilds
    free = ge.reveal_event(_FakeState(free=True), expanded_reels=[1, 2, 3])
    assert free["expandedReels"] == [1, 2, 3]
    assert not validate_event(free)
    free_none = ge.reveal_event(_FakeState(free=True), expanded_reels=[])
    assert "expandedReels" not in free_none


def test_standalone_engine_emits_only_valid_events():
    definition = load_definition("novaforged")
    _, engine = build_engine("novaforged")
    rng = Rng(0)
    for i in range(3000):
        rng.reseed(i)
        result = engine.play_round(i + 1, rng)
        book = {"id": i + 1, "payoutMultiplier": result.payout_multiplier, "events": result.events}
        problems = validate_book(book, wincap=definition.wincap)
        assert not problems, f"sim {i}: {problems}"


def test_forced_freegame_book_is_valid():
    definition = load_definition("novaforged")
    _, engine = build_engine("novaforged")
    rng = Rng(1)
    for i in range(500):
        rng.reseed(i)
        result = engine.play_round(i + 1, rng, force_free=True)
        book = {"id": i + 1, "payoutMultiplier": result.payout_multiplier, "events": result.events}
        assert not validate_book(book, wincap=definition.wincap)
