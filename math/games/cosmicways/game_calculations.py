"""Pure win calculations for Cosmic Ways (no event side effects).

All-ways evaluation: a paytable symbol pays when it (or a wild) appears on
adjacent reels from the leftmost reel; the win counts *ways* = product of the
symbol's per-reel occurrence counts across the matched reels. The algorithm is
intentionally identical in behaviour to the standalone engine
(``math/simulator/mechanics.py::WaysMechanic``) so simulated outcomes match.

The SDK ``Lines`` base is reused only for its mechanic-agnostic board/reel
utilities (``create_board_reelstrips``, padding); the win evaluation here is
ways-specific.
"""

from src.calculations.lines import Lines  # type: ignore  # provided by the SDK


class GameCalculations(Lines):
    def get_way_wins(self, board):
        """Return winning symbols: {symbol, count, ways, amount, wild_mult}."""
        wins = []
        wild = self.config.wild_symbol
        for sym, pays in self.config.symbol_paytable.items():
            if sym == self.scatter_symbol:
                continue
            counts = []
            has_wild = False
            for reel in range(self.config.num_reels):
                c = 0
                for cell in board[reel]:
                    name = cell.name
                    if name == sym or name == wild:
                        c += 1
                        has_wild = has_wild or (name == wild)
                if c == 0:
                    break
                counts.append(c)
            run = len(counts)
            if run < 3:
                continue
            pay_count = next((k for k in range(run, 2, -1) if k in pays), None)
            if pay_count is None:
                continue
            ways = 1
            for c in counts[:pay_count]:
                ways *= c
            wild_mult = self.expected_wild_multiplier if (self.in_freegame and has_wild) else 1
            wins.append(
                {
                    "symbol": sym,
                    "count": pay_count,
                    "ways": ways,
                    "amount": pays[pay_count],
                    "wild_mult": wild_mult,
                }
            )
        return wins

    def apply_expanding_wilds(self):
        """Cosmic Ways disables expanding wilds; kept for parity with the lines
        path so the executables layer is shared-shaped. Returns ``[]``."""
        return []

    def count_special_symbol(self, board, symbol) -> int:
        return sum(1 for col in board for cell in col if cell.name == symbol)
