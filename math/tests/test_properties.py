"""Property-based tests for the NovaForged engine (hypothesis).

Where ``test_engine.py`` checks a few explicit scenarios, these assert invariants
that must hold for *any* seed/board the engine can produce — the kind of edge
that hides reel-imbalance and feature bugs. Hypothesis is a test-only dependency;
the engine itself stays standard-library only.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from hypothesis import given, settings
from hypothesis import strategies as st

from simulator.bookcontract import validate_book  # noqa: E402
from simulator.definition import load_definition  # noqa: E402
from simulator.runner import build_engine  # noqa: E402
from simulator.rng import Rng  # noqa: E402

_DEF = load_definition("novaforged")
_ENGINE = build_engine("novaforged")[1]


@given(seed=st.integers(min_value=0, max_value=2_000_000))
@settings(max_examples=120, deadline=None)
def test_payout_never_exceeds_wincap(seed: int):
    rng = Rng(seed)
    result = _ENGINE.play_round(seed + 1, rng)
    assert 0 <= result.payout_multiplier <= _DEF.wincap + 1e-6


@given(seed=st.integers(min_value=0, max_value=2_000_000))
@settings(max_examples=150, deadline=None)
def test_every_book_is_contract_valid(seed: int):
    rng = Rng(seed)
    result = _ENGINE.play_round(seed + 1, rng)
    book = {"id": seed + 1, "payoutMultiplier": result.payout_multiplier, "events": result.events}
    assert validate_book(book, wincap=_DEF.wincap) == []


@given(seed=st.integers(min_value=0, max_value=2_000_000))
@settings(max_examples=150, deadline=None)
def test_forced_buy_is_always_a_freegame(seed: int):
    rng = Rng(seed)
    result = _ENGINE.play_round(seed + 1, rng, force_free=True)
    assert result.triggered_freegame
    assert any(e["type"] == "freeSpinTrigger" for e in result.events)


@given(seed=st.integers(min_value=0, max_value=2_000_000))
@settings(max_examples=120, deadline=None)
def test_board_dimensions_are_constant(seed: int):
    rng = Rng(seed)
    result = _ENGINE.play_round(seed + 1, rng)
    for ev in result.events:
        if ev["type"] == "reveal":
            assert len(ev["board"]) == _DEF.num_reels
            assert all(len(col) == _DEF.num_rows for col in ev["board"])


@given(seed=st.integers(min_value=0, max_value=2_000_000))
@settings(max_examples=120, deadline=None)
def test_free_reveals_carry_realized_multiplier_wilds(seed: int):
    """Any wild visible on a free-spin board must have a realized multiplier
    entry (the certification fix: no averaged approximation)."""
    rng = Rng(seed)
    result = _ENGINE.play_round(seed + 1, rng, force_free=True)
    wild = _DEF.wild
    for ev in result.events:
        if ev["type"] == "reveal" and ev["gameType"] == "free":
            wild_cells = {
                (r, c) for r, col in enumerate(ev["board"]) for c, s in enumerate(col) if s == wild
            }
            tagged = {(m["reel"], m["row"]) for m in ev.get("multiplierWilds", [])}
            assert wild_cells == tagged
            for m in ev.get("multiplierWilds", []):
                assert m["value"] in _DEF.mult_wild_values
