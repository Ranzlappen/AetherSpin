"""Pure win calculations for NovaForged (no event side effects).

Sits between the SDK ``Calculations`` base and the executables layer. The
algorithms here are intentionally identical in behaviour to the standalone
engine in ``math/simulator/engine.py`` so simulated outcomes match — including
**realized** free-game multiplier wilds: each wild cell draws its own multiplier
(``mult_wild_values @ mult_wild_weights``), the values are surfaced to the client
on the reveal as ``multiplierWilds``, and a winning line's multiplier is the SUM
of the realized values of the wild cells participating in the run (additive).
This replaces the earlier single averaged ``expected_wild_multiplier``, which
diverged from the standalone/frontend and distorted free-game RTP (ADR 0005).
"""

import random

from src.calculations.lines import Lines  # type: ignore  # provided by the SDK


class GameCalculations(Lines):
    EXPANDING_REELS = (1, 2, 3)  # middle three reels, 0-indexed

    def sample_multiplier_grid(self, board):
        """Sample a realized multiplier for every wild cell on ``board`` (free game).

        Mirrors ``math/simulator/engine.py::_sample_multiplier_grid``. Returns
        ``(grid, payload)`` where ``grid[reel][row]`` is the realized multiplier
        (1 for non-wild cells) and ``payload`` is the ``[{reel,row,value}]`` list
        for the reveal's ``multiplierWilds``.

        Randomness uses Python's ``random`` (the math-sdk seeds it per simulation
        for reproducibility); the standalone draws the same value@weight
        distribution. Verify the realized stream against a real SDK run before
        relying on it for certification (ADR 0005).
        """
        wild = self.config.wild_symbol
        vals, wts = self.config.mult_wild_values, self.config.mult_wild_weights
        grid = [[1] * len(board[reel]) for reel in range(self.config.num_reels)]
        payload = []
        for reel in range(self.config.num_reels):
            for row in range(len(board[reel])):
                if board[reel][row].name == wild:
                    value = int(random.choices(vals, weights=wts, k=1)[0])
                    grid[reel][row] = value
                    payload.append({"reel": reel, "row": row, "value": value})
        return grid, payload

    def get_line_wins(self, board, mult_grid=None):
        """Return a list of winning lines: {line, symbol, count, amount, wild_mult}.

        ``mult_grid`` (free game only) carries the realized per-cell multipliers;
        ``None`` means no wild multipliers apply (base game).
        """
        wins = []
        wild = self.config.wild_symbol
        for line_idx, pattern in self.config.paylines.items():
            positions = [(reel, pattern[reel]) for reel in range(self.config.num_reels)]
            symbols = [board[reel][row].name for reel, row in positions]
            result = self._evaluate_line(symbols, positions, wild, mult_grid)
            if result is not None:
                sym, count, value, wild_mult = result
                wins.append(
                    {"line": line_idx, "symbol": sym, "count": count, "amount": value, "wild_mult": wild_mult}
                )
        return wins

    def _evaluate_line(self, symbols, positions, wild, mult_grid):
        pay_symbol = None
        for s in symbols:
            if s == self.scatter_symbol:
                break
            if s != wild:
                pay_symbol = s
                break
        if pay_symbol is None:
            pay_symbol = wild

        # Left-aligned run; in the free game a participating wild contributes its
        # realized multiplier (summed), matching the standalone LinesMechanic.
        count, wild_sum, has_wild = 0, 0, False
        for idx, s in enumerate(symbols):
            if s == pay_symbol or s == wild:
                count += 1
                if s == wild and mult_grid is not None:
                    reel, row = positions[idx]
                    wild_sum += mult_grid[reel][row]
                    has_wild = True
            else:
                break
        wild_mult = wild_sum if has_wild else 1

        pays = self.config.symbol_paytable.get(pay_symbol, {})
        for c in range(count, 2, -1):
            if c in pays:
                return pay_symbol, c, pays[c], wild_mult
        return None

    def apply_expanding_wilds(self):
        """Expand any wild on the middle reels to a full wild reel (free game only).

        Returns the list of reels that expanded so the reveal event can report
        ``expandedReels`` in lock-step with the standalone engine.
        """
        expanded = []
        if not self.in_freegame or not self.config.expanding_wilds:
            return expanded
        wild = self.config.wild_symbol
        for r in self.EXPANDING_REELS:
            if any(cell.name == wild for cell in self.board[r]):
                for cell in self.board[r]:
                    cell.name = wild
                expanded.append(r)
        return expanded

    def count_special_symbol(self, board, symbol) -> int:
        return sum(1 for col in board for cell in col if cell.name == symbol)
