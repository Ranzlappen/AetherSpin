"""The buy-bonus RTP gate must never license an EV-positive buy (SECURITY.md)."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from validate_rtp import bonus_upper_bound  # noqa: E402


def test_wide_tolerance_is_clamped_at_break_even():
    # target + tol would be > 1.0, but the buy-bonus must never be EV-positive,
    # so the gate clamps the upper bound at break-even.
    assert bonus_upper_bound(0.965, 0.05) == 1.0
    assert bonus_upper_bound(0.97, 0.10) == 1.0
    assert bonus_upper_bound(1.0, 0.0) == 1.0


def test_tolerance_applies_below_break_even():
    assert bonus_upper_bound(0.90, 0.05) == 0.90 + 0.05
    assert bonus_upper_bound(0.80, 0.10) == 0.80 + 0.10
