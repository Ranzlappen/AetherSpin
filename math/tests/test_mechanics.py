"""Tests for the pluggable win-mechanic seam."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

MATH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MATH_ROOT / "simulator"))
sys.path.insert(0, str(MATH_ROOT))

from simulator.definition import load_definition  # noqa: E402
from simulator.mechanics import (  # noqa: E402
    LinesMechanic,
    WinMechanic,
    build_mechanic,
    register_mechanic,
)


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
