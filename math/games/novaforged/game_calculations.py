"""Pure win calculations for NovaForged (no event side effects).

Sits between the SDK ``Calculations`` base and the executables layer. The
algorithms here are intentionally identical in behaviour to the standalone
engine in ``math/simulator/engine.py`` so simulated outcomes match.
"""

from src.calculations.lines import Lines  # type: ignore  # provided by the SDK


class GameCalculations(Lines):
    EXPANDING_REELS = (1, 2, 3)  # middle three reels, 0-indexed

    def get_line_wins(self, board):
        """Return a list of winning lines: {line, symbol, count, amount, wild_mult}."""
        wins = []
        wild = self.config.wild_symbol
        for line_idx, pattern in self.config.paylines.items():
            symbols = [board[reel][pattern[reel]].name for reel in range(self.config.num_reels)]
            result = self._evaluate_line(symbols, wild)
            if result is not None:
                sym, count, value, wild_mult = result
                wins.append(
                    {"line": line_idx, "symbol": sym, "count": count, "amount": value, "wild_mult": wild_mult}
                )
        return wins

    def _evaluate_line(self, symbols, wild):
        pay_symbol = None
        for s in symbols:
            if s == self.scatter_symbol:
                break
            if s != wild:
                pay_symbol = s
                break
        if pay_symbol is None:
            pay_symbol = wild

        count, has_wild = 0, False
        for s in symbols:
            if s == pay_symbol or s == wild:
                count += 1
                has_wild = has_wild or (s == wild)
            else:
                break

        wild_mult = self.expected_wild_multiplier if (self.in_freegame and has_wild) else 1
        pays = self.config.symbol_paytable.get(pay_symbol, {})
        for c in range(count, 2, -1):
            if c in pays:
                return pay_symbol, c, pays[c], wild_mult
        return None

    def apply_expanding_wilds(self):
        """Expand any wild on the middle reels to a full wild reel (free game only)."""
        if not self.in_freegame or not self.config.expanding_wilds:
            return
        wild = self.config.wild_symbol
        for r in self.EXPANDING_REELS:
            if any(cell.name == wild for cell in self.board[r]):
                for cell in self.board[r]:
                    cell.name = wild

    def count_special_symbol(self, board, symbol) -> int:
        return sum(1 for col in board for cell in col if cell.name == symbol)
