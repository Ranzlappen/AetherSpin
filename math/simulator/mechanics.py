"""Pluggable win-evaluation mechanics.

A *mechanic* answers a single question: given a drawn board (and, in the free
game, a per-cell wild-multiplier grid), what does it pay and which win
descriptors should the frontend replay? Everything else about a round — drawing
boards, scatters, the free game, expanding/multiplier wilds, the win cap — is
generic and owned by :class:`~simulator.engine.SlotEngine`.

This is the extension seam for new game types: implement :class:`WinMechanic`,
register it under the definition's ``engine.type``, and the same engine, library
writer, and RGS contract work unchanged. ``lines`` ships here; ``ways`` /
``cluster`` plug in the same way.

Stdlib only.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable

from .definition import GameDefinition


class WinMechanic(ABC):
    """Maps a board to (total payout in total-bet units, ordered win list)."""

    #: Event ``type`` emitted for this mechanic's win list (e.g. ``"lineWins"``).
    win_event_type: str = "wins"

    @abstractmethod
    def evaluate(
        self, board: list[list[str]], mult_grid: list[list[int]] | None
    ) -> tuple[float, list[dict[str, Any]]]:
        """Return ``(total, wins)``. ``mult_grid`` (free game only) carries the
        realized per-cell wild multiplier; ``None`` means no wild multipliers."""
        raise NotImplementedError


class LinesMechanic(WinMechanic):
    """Fixed-payline, left-aligned line evaluation (NovaForged's mechanic)."""

    win_event_type = "lineWins"

    def __init__(self, definition: GameDefinition) -> None:
        self.d = definition
        self.wild = definition.wild
        self.scatter = definition.scatter
        self.paytable = definition.paytable
        self.paylines = definition.paylines
        self.num_lines = definition.num_paylines
        self.num_reels = definition.num_reels

    def evaluate(
        self, board: list[list[str]], mult_grid: list[list[int]] | None = None
    ) -> tuple[float, list[dict[str, Any]]]:
        total = 0.0
        wins: list[dict[str, Any]] = []
        for line_idx, pattern in enumerate(self.paylines):
            positions = [(reel, pattern[reel]) for reel in range(self.num_reels)]
            symbols = [board[reel][row] for reel, row in positions]
            win = self._evaluate_single_line(symbols, positions, mult_grid)
            if win is None:
                continue
            sym, count, line_value, mult = win
            payout = (line_value / self.num_lines) * mult
            total += payout
            wins.append(
                {
                    "line": line_idx,
                    "symbol": sym,
                    "count": count,
                    "wildMultiplier": mult,
                    "amount": round(payout, 6),
                }
            )
        return total, wins

    def _evaluate_single_line(self, symbols, positions, mult_grid):
        """Left-aligned line win. Returns (symbol, count, base_value, wild_mult).

        In the free game the line's wild multiplier is the SUM of the realized
        multipliers of the wild cells participating in the winning run
        (additive multiplier wilds). Sum (rather than product) keeps volatility
        bounded and the RTP tractable while still using the real, player-visible
        per-cell values.
        """
        pay_symbol = None
        for s in symbols:
            if s == self.scatter:
                break
            if s != self.wild:
                pay_symbol = s
                break
        if pay_symbol is None:
            pay_symbol = self.wild

        count = 0
        wild_sum = 0
        has_wild = False
        for idx, s in enumerate(symbols):
            if s == pay_symbol or s == self.wild:
                count += 1
                if s == self.wild and mult_grid is not None:
                    reel, row = positions[idx]
                    wild_sum += mult_grid[reel][row]
                    has_wild = True
            else:
                break
        wild_mult = wild_sum if has_wild else 1

        pays = self.paytable.get(pay_symbol, {})
        if count in pays:
            return pay_symbol, count, pays[count], wild_mult
        # try shorter matches that still pay (e.g. 5 wilds but symbol only pays 3)
        for c in range(count, 2, -1):
            if c in pays:
                return pay_symbol, c, pays[c], wild_mult
        return None


# --- registry ---------------------------------------------------------------

MechanicFactory = Callable[[GameDefinition], WinMechanic]
_REGISTRY: dict[str, MechanicFactory] = {}


def register_mechanic(name: str, factory: MechanicFactory) -> None:
    """Register a mechanic factory under an ``engine.type`` id."""
    _REGISTRY[name] = factory


def build_mechanic(definition: GameDefinition) -> WinMechanic:
    """Resolve the mechanic for a definition's ``engine.type`` from the registry."""
    name = definition.engine_type
    factory = _REGISTRY.get(name)
    if factory is None:
        raise ValueError(
            f"unknown engine mechanic {name!r}; registered: {sorted(_REGISTRY)}"
        )
    return factory(definition)


register_mechanic("lines", LinesMechanic)
