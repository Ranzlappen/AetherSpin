"""Pure win calculations for Stellar Clusters (no event side effects).

Cluster-pays evaluation: each orthogonally-connected group of one symbol (wilds
substitute) of size >= 3 pays ``paytable[symbol][size]``, capped at the largest
size the paytable defines. The algorithm is intentionally identical in behaviour
to the standalone engine (``math/simulator/mechanics.py::ClusterMechanic``) so
simulated outcomes match.

The SDK ``Lines`` base is reused only for its mechanic-agnostic board/reel
utilities (``create_board_reelstrips``, padding); the win evaluation here is
cluster-specific.
"""

from src.calculations.lines import Lines  # type: ignore  # provided by the SDK


class GameCalculations(Lines):
    def get_cluster_wins(self, board):
        """Return winning groups: {symbol, count, amount, wild_mult, cells}.

        ``count`` is the connected group size; ``cells`` are the board positions
        ``{reel, row}`` it occupies. An all-wild blob does not pay as every
        symbol — a real (non-wild) cell must be present in the group.
        """
        wins = []
        wild = self.config.wild_symbol
        num_reels = self.config.num_reels
        num_rows = self.config.num_rows[0] if isinstance(self.config.num_rows, list) else self.config.num_rows
        for sym, pays in self.config.symbol_paytable.items():
            if sym == self.scatter_symbol:
                continue
            if not pays:
                continue
            max_size = max(pays)
            seen = set()
            for r0 in range(num_reels):
                for c0 in range(num_rows):
                    if (r0, c0) in seen:
                        continue
                    name = board[r0][c0].name
                    if name != sym and name != wild:
                        continue
                    # Flood-fill the connected (sym-or-wild) component.
                    comp = []
                    stack = [(r0, c0)]
                    while stack:
                        x, y = stack.pop()
                        if (x, y) in seen:
                            continue
                        if not (0 <= x < num_reels and 0 <= y < num_rows):
                            continue
                        cell_name = board[x][y].name
                        if cell_name != sym and cell_name != wild:
                            continue
                        seen.add((x, y))
                        comp.append((x, y))
                        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                    if not any(board[x][y].name == sym for x, y in comp):
                        continue
                    size = len(comp)
                    pay_size = next((k for k in range(min(size, max_size), 2, -1) if k in pays), None)
                    if pay_size is None:
                        continue
                    wild_mult = self.expected_wild_multiplier if self.in_freegame else 1
                    wins.append(
                        {
                            "symbol": sym,
                            "count": size,
                            "amount": pays[pay_size],
                            "wild_mult": wild_mult,
                            "cells": [{"reel": x, "row": y} for x, y in comp],
                        }
                    )
        return wins

    def apply_expanding_wilds(self):
        """Stellar Clusters disables expanding wilds; kept for parity with the
        lines path so the executables layer is shared-shaped. Returns ``[]``."""
        return []

    def count_special_symbol(self, board, symbol) -> int:
        return sum(1 for col in board for cell in col if cell.name == symbol)
