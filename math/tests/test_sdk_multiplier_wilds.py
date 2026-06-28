"""Parity unit test for NovaForged's reconciled SDK multiplier wilds (ADR 0005).

The official-SDK module (``math/games/novaforged/game_calculations.py``) used to
apply a single *averaged* ``expected_wild_multiplier`` in the free game, which
diverged from the standalone engine (which realizes a multiplier per wild cell
and sums the participating cells per line). That gap is invisible to the
``py_compile`` gate and to the event-contract test, and a real SDK run isn't
available in CI — so this test proves the reconciled line math directly, without
the SDK, by:

1. stubbing the SDK ``Lines`` base so ``game_calculations`` imports standalone, and
2. running BOTH the reconciled SDK ``get_line_wins`` and the validated standalone
   ``LinesMechanic`` on the **same** board and the **same** realized multiplier
   grid, asserting identical wins (symbol, count, summed wild multiplier, payout).

It also checks ``sample_multiplier_grid`` realizes one value per wild cell from
the configured value@weight distribution.
"""

from __future__ import annotations

import importlib.util
import random
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.definition import load_definition  # noqa: E402
from simulator.mechanics import LinesMechanic  # noqa: E402


def _load_sdk_calculations():
    """Import the SDK ``game_calculations`` with a stubbed ``Lines`` base (the
    real base ships only with the non-vendored math-sdk)."""
    pkg_src = types.ModuleType("src")
    pkg_calc = types.ModuleType("src.calculations")
    mod_lines = types.ModuleType("src.calculations.lines")

    class _Lines:  # minimal stand-in for the SDK base
        pass

    mod_lines.Lines = _Lines
    pkg_src.calculations = pkg_calc
    pkg_calc.lines = mod_lines
    sys.modules.setdefault("src", pkg_src)
    sys.modules.setdefault("src.calculations", pkg_calc)
    sys.modules.setdefault("src.calculations.lines", mod_lines)

    path = ROOT / "games" / "novaforged" / "game_calculations.py"
    spec = importlib.util.spec_from_file_location("nf_sdk_game_calculations", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


GC = _load_sdk_calculations()
D = load_definition("novaforged")


class _Cell:
    __slots__ = ("name",)

    def __init__(self, name: str) -> None:
        self.name = name


class _Config:
    """The handful of attributes ``game_calculations`` reads off ``self.config``."""

    def __init__(self) -> None:
        self.wild_symbol = D.wild
        self.num_reels = D.num_reels
        self.num_rows = [D.num_rows] * D.num_reels
        self.paylines = {i: list(p) for i, p in enumerate(D.paylines)}
        self.symbol_paytable = {sym: dict(pays) for sym, pays in D.paytable.items()}
        self.mult_wild_values = list(D.mult_wild_values)
        self.mult_wild_weights = list(D.mult_wild_weights)


def _make_sdk():
    sdk = GC.GameCalculations()
    sdk.config = _Config()
    sdk.scatter_symbol = D.scatter
    sdk.in_freegame = True
    return sdk


# Symbol pool for fuzzing boards: pay symbols + wild + scatter.
_POOL = list(D.paytable.keys()) + [D.wild, D.scatter]


def _random_board(rng: random.Random):
    """A 5x3 board of cell objects (SDK shape) plus its symbol-name twin (engine shape)."""
    names = [[rng.choice(_POOL) for _ in range(D.num_rows)] for _ in range(D.num_reels)]
    cells = [[_Cell(n) for n in col] for col in names]
    return cells, names


def _realized_grid(names, rng: random.Random):
    """A per-cell multiplier grid: a realized value at each wild cell, 1 elsewhere."""
    grid = [[1] * D.num_rows for _ in range(D.num_reels)]
    for reel in range(D.num_reels):
        for row in range(D.num_rows):
            if names[reel][row] == D.wild:
                grid[reel][row] = rng.choices(D.mult_wild_values, weights=D.mult_wild_weights, k=1)[0]
    return grid


def test_sdk_line_wins_match_standalone_with_realized_wilds():
    """Same board + same realized grid → identical wins from both engines."""
    sdk = _make_sdk()
    mech = LinesMechanic(D)
    rng = random.Random(20260628)
    compared = 0
    saw_summed_wild = False
    for _ in range(4000):
        cells, names = _random_board(rng)
        grid = _realized_grid(names, rng)

        std_total, std_wins = mech.evaluate(names, mult_grid=grid)
        sdk_raw = sdk.get_line_wins(cells, mult_grid=grid)
        sdk_wins = {
            w["line"]: (
                w["symbol"],
                w["count"],
                w["wild_mult"],
                round((w["amount"] / D.num_paylines) * w["wild_mult"], 6),
            )
            for w in sdk_raw
        }
        std_by_line = {
            w["line"]: (w["symbol"], w["count"], w["wildMultiplier"], w["amount"]) for w in std_wins
        }
        assert sdk_wins == std_by_line, f"divergence on board {names}: sdk={sdk_wins} std={std_by_line}"
        compared += len(std_by_line)
        # A summed (>1, and frequently not a member of {2,3,5}) wild multiplier is
        # the realized behaviour the averaged approach could never produce.
        if any(v[2] > 1 for v in std_by_line.values()):
            saw_summed_wild = True
    assert compared > 0, "fuzz produced no wins to compare — board pool likely wrong"
    assert saw_summed_wild, "fuzz never exercised a wild-multiplied line"


def test_base_game_has_no_wild_multiplier():
    """With no grid (base game) a participating wild contributes multiplier 1."""
    sdk = _make_sdk()
    sdk.in_freegame = False
    # W,W,H1 across the top line (payline 0 is row 1 though) — build an explicit board.
    line0 = D.paylines[0]  # rows for each reel
    names = [[D.scatter] * D.num_rows for _ in range(D.num_reels)]
    for reel, row in enumerate(line0):
        names[reel][row] = D.wild if reel < 2 else "H1"
    cells = [[_Cell(n) for n in col] for col in names]
    wins = sdk.get_line_wins(cells, mult_grid=None)
    line0_win = next(w for w in wins if w["line"] == 0)
    assert line0_win["wild_mult"] == 1


def test_sample_multiplier_grid_realizes_per_cell_values():
    """Every wild cell gets a value from the configured set; non-wild cells stay 1."""
    sdk = _make_sdk()
    random.seed(7)
    names = [[D.wild if (reel + row) % 2 == 0 else "H1" for row in range(D.num_rows)] for reel in range(D.num_reels)]
    cells = [[_Cell(n) for n in col] for col in names]
    grid, payload = sdk.sample_multiplier_grid(cells)

    allowed = set(D.mult_wild_values)
    seen = {(p["reel"], p["row"]): p["value"] for p in payload}
    for reel in range(D.num_reels):
        for row in range(D.num_rows):
            if names[reel][row] == D.wild:
                assert grid[reel][row] in allowed, f"wild ({reel},{row}) value {grid[reel][row]} not in {allowed}"
                assert seen[(reel, row)] == grid[reel][row]
            else:
                assert grid[reel][row] == 1
                assert (reel, row) not in seen
    assert len(payload) == sum(row.count(D.wild) for row in [[names[r][c] for c in range(D.num_rows)] for r in range(D.num_reels)])
