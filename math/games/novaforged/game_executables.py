"""Reusable executable steps for NovaForged (real math-sdk API).

These mirror the standalone engine (`math/simulator/engine.py` +
`mechanics.py`) so the certified math evaluates a board the same way:

* **Line wins** use the SDK's native additive multiplier-wild strategy
  (`multiplier_method="symbol"` → the per-line wild multiplier is the SUM of the
  realized wild-cell multipliers, floored at 1).
* **Scatter** is a special pay/trigger, evaluated off the board (not a line
  symbol) from `config.scatter_paytable`.
* **Free game** applies the escalating global-multiplier ladder and the
  free-game win scale to the WHOLE spin win (lines + scatter), exactly as the
  standalone does: ``spin_win = (lines + scatter) * global_mult * win_scale``.
* **Expanding wilds** turn any of the middle reels carrying a wild into a full
  wild reel (free game only), each new cell sampling its own realized
  multiplier.

Win evaluation only *computes and stashes* the per-board results
(`contract_line_wins` / `contract_line_total` / `contract_scatter`) and updates
the win manager; the gamestate emits the shared `BookEvent`s (see
`game_events.py`) in the right order.
"""

from game_calculations import GameCalculations
from src.calculations.lines import Lines  # type: ignore
from src.calculations.statistics import get_random_outcome  # type: ignore


class GameExecutables(GameCalculations):
    def evaluate_board_wins(self):
        """Evaluate line + scatter wins, apply free-game scaling, bank, and
        stash the contract-shaped results for event emission.

        Line evaluation uses the additive symbol-multiplier strategy so the
        realized wild multipliers sum per line (matching the standalone). In the
        free game the whole spin win — lines and scatter together — is scaled by
        the current ladder multiplier and the free-game win scale.
        """
        self.win_data = Lines.get_lines(self.board, self.config, multiplier_method="symbol")
        Lines.record_lines_wins(self)
        line_total = self.win_data["totalWin"]
        self.contract_line_wins = self._to_contract_line_wins(self.win_data["wins"])
        self.contract_line_total = line_total

        scatter_count = self.count_special_symbols("scatter")
        scatter_total = float(self.config.scatter_paytable.get(scatter_count, 0.0))
        self.contract_scatter = (
            {"count": scatter_count, "amount": round(scatter_total, 6)} if scatter_total > 0 else None
        )

        if self.gametype == self.config.freegame_type:
            spin_win = (line_total + scatter_total) * self.global_multiplier * self.config.free_win_scale
        else:
            spin_win = line_total + scatter_total

        self.win_manager.update_spinwin(round(spin_win, 6))
        self.evaluate_wincap()

    @staticmethod
    def _to_contract_line_wins(sdk_wins: list) -> list:
        """Translate SDK line-win dicts into the shared `LineWin` shape.

        With ``global_multiplier=1`` the SDK's per-line ``win`` is the base
        payout times the summed wild multiplier — exactly the standalone's
        unscaled per-line amount (the global/free scaling is applied to the spin
        total, not the line). ``meta.multiplier`` is that summed wild multiplier.
        """
        wins = []
        for win in sdk_wins:
            meta = win["meta"]
            wins.append(
                {
                    "line": int(meta["lineIndex"]) - 1,  # SDK payline ids are 1-indexed
                    "symbol": win["symbol"],
                    "count": int(win["kind"]),
                    "wildMultiplier": int(meta["multiplier"]),
                    "amount": round(float(win["win"]), 6),
                }
            )
        return wins

    def expand_wilds(self) -> None:
        """Expand any middle reel holding a wild into a full wild reel.

        Free-game only. Each cell of an expanded reel samples its own realized
        multiplier from the free-game distribution, mirroring the standalone's
        independent per-cell sampling. Scatters on an expanded reel are
        overwritten, so callers must re-scan the board afterwards.
        """
        expanded = []
        conditions = self.get_current_distribution_conditions()
        for reel in self.config.expanding_reels:
            if any(self.board[reel][row].check_attribute("wild") for row in range(self.config.num_rows[reel])):
                for row in range(self.config.num_rows[reel]):
                    mult = get_random_outcome(conditions["mult_values"][self.gametype])
                    wild = self.create_symbol(self.config.wild_symbol)
                    wild.assign_attribute({"multiplier": mult})
                    self.board[reel][row] = wild
                expanded.append(reel)
        self.expanding_wild_reels = expanded

    def evaluate_wincap(self) -> bool:
        """Flag the win-cap without emitting the SDK's native `wincap` event —
        the contract carries the cap on `finalWin.wincap` instead."""
        if self.win_manager.running_bet_win >= self.config.wincap and not self.wincap_triggered:
            self.wincap_triggered = True
            return True
        return False

    def bump_ladder(self) -> bool:
        """Advance the global-multiplier ladder after a winning free spin.

        Returns True if the multiplier actually advanced (so the caller can emit
        a `ladderStep`)."""
        if self.win_manager.spin_win > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier = min(
                self.config.ladder_max, self.global_multiplier + self.config.ladder_step
            )
            return True
        return False
