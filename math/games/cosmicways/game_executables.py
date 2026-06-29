"""Reusable executable steps for Cosmic Ways (real math-sdk API).

The win mechanic is all-ways: `Ways.get_ways_data` evaluates the board (a symbol
pays on consecutive reels from the left; ways = product of per-reel counts).
Scatter is a special pay/trigger, and in the free game the whole spin win (ways +
scatter) is scaled by the ladder multiplier (flat here) and the free-game win
scale — matching the standalone `WaysMechanic`.
"""

from game_calculations import GameCalculations
from src.calculations.ways import Ways  # type: ignore
from src.calculations.statistics import get_random_outcome  # type: ignore


class GameExecutables(GameCalculations):
    def evaluate_board_wins(self):
        """Evaluate ways + scatter wins, apply free-game scaling, bank, and stash
        the contract-shaped results for event emission."""
        self.win_data = Ways.get_ways_data(self.config, self.board, multiplier_strategy="symbol")
        Ways.record_ways_wins(self)
        win_total = self.win_data["totalWin"]
        self.contract_wins = self._to_contract_wins(self.win_data["wins"])
        self.contract_win_total = win_total

        scatter_count = self.count_special_symbols("scatter")
        scatter_total = float(self.config.scatter_paytable.get(scatter_count, 0.0))
        self.contract_scatter = (
            {"count": scatter_count, "amount": round(scatter_total, 6)} if scatter_total > 0 else None
        )

        if self.gametype == self.config.freegame_type:
            spin_win = (win_total + scatter_total) * self.global_multiplier * self.config.free_win_scale
        else:
            spin_win = win_total + scatter_total

        self.win_manager.update_spinwin(round(spin_win, 6))
        self.evaluate_wincap()

    @staticmethod
    def _to_contract_wins(sdk_wins: list) -> list:
        """Translate SDK ways-win dicts into the shared `WayWin` shape. Multiplier
        wilds are disabled for this game, so wildMultiplier is 1."""
        wins = []
        for win in sdk_wins:
            meta = win["meta"]
            wins.append(
                {
                    "symbol": win["symbol"],
                    "count": int(win["kind"]),
                    "ways": int(meta.get("ways", 1)),
                    "wildMultiplier": 1,
                    "amount": round(float(win["win"]), 6),
                }
            )
        return wins

    def expand_wilds(self) -> None:
        """Expanding wilds are disabled for this game."""
        self.expanding_wild_reels = []

    def evaluate_wincap(self) -> bool:
        """Flag the win-cap without the SDK's native event (folded into finalWin)."""
        if self.win_manager.running_bet_win >= self.config.wincap and not self.wincap_triggered:
            self.wincap_triggered = True
            return True
        return False

    def bump_ladder(self) -> bool:
        """Advance the ladder after a winning free spin (no-op when flat)."""
        if self.win_manager.spin_win > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier = min(
                self.config.ladder_max, self.global_multiplier + self.config.ladder_step
            )
            return True
        return False
