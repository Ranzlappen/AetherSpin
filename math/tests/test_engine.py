"""Unit tests for the NovaForged standalone engine.

Fast, hermetic tests (stdlib only) that gate CI. They assert structural
correctness and statistical sanity rather than exact RTP convergence (which a
high-volatility title only reaches over millions of spins).
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from simulator.definition import load_definition  # noqa: E402
from simulator.runner import build_engine, run_simulations  # noqa: E402
from simulator.rng import Rng  # noqa: E402


def test_definition_loads():
    d = load_definition("novaforged")
    assert d.num_reels == 5
    assert d.num_rows == 3
    assert d.num_paylines == 20
    assert d.wild == "W"
    assert d.scatter == "S"
    assert 0.9 < d.rtp_target < 1.0


def test_reels_have_all_symbols():
    d, engine = build_engine("novaforged")
    symbols = set(d.symbol_ids())
    for strip in engine.base_reels.strips:
        assert set(strip).issubset(symbols)
    assert engine.base_reels.num_reels == 5


def test_single_round_structure():
    d, engine = build_engine("novaforged")
    rng = Rng(123)
    result = engine.play_round(1, rng)
    assert result.payout_multiplier >= 0
    assert result.events[0]["type"] == "reveal"
    assert result.events[-1]["type"] == "finalWin"
    # board shape
    board = result.events[0]["board"]
    assert len(board) == 5 and all(len(col) == 3 for col in board)


def test_payout_never_exceeds_wincap():
    d, engine = build_engine("novaforged")
    rng = Rng(7)
    for i in range(2000):
        rng.reseed(i)
        result = engine.play_round(i, rng)
        assert result.payout_multiplier <= d.wincap + 1e-6


def test_forced_freegame_triggers():
    d, engine = build_engine("novaforged")
    rng = Rng(1)
    result = engine.play_round(1, rng, force_free=True)
    assert result.triggered_freegame
    assert any(e["type"] == "freeSpinTrigger" for e in result.events)


def test_rtp_in_sane_range():
    # Small-sample sanity check: RTP should be a plausible fraction, not zero
    # and not wildly above the cap-driven ceiling.
    out = run_simulations("novaforged", {"base": 20000}, seed=42)
    rtp = out.stats["base"].rtp
    assert 0.5 < rtp < 1.6, f"RTP {rtp} outside sane range for sample"


def test_buy_bonus_not_player_positive():
    # The buy-bonus must never be EV-positive for the player: its RTP must sit at
    # or below the game's RTP target (within a small tolerance), NOT merely below
    # 100%+slack. Seeding is deterministic (PYTHONHASHSEED-independent), so this
    # bound is reproducible rather than flaky. See SECURITY.md.
    definition = load_definition("novaforged")
    out = run_simulations("novaforged", {"bonus": 40000}, seed=3)
    bonus_rtp = out.stats["bonus"].rtp
    assert bonus_rtp <= definition.rtp_target + 0.03, (
        f"buy-bonus RTP {bonus_rtp:.4f} exceeds target {definition.rtp_target:.4f} "
        "+ tol — would be EV-positive / non-compliant"
    )
