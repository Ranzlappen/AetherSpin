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
"""

from game_calculations import GameCalculations
from src.calculations.lines import Lines  # type: ignore
from src.calculations.statistics import get_random_outcome  # type: ignore


class GameExecutables(GameCalculations):
    def evaluate_board_wins(self):
        """Evaluate line + scatter wins, apply free-game scaling, bank + emit.

        Line evaluation uses the additive symbol-multiplier strategy so the
        realized wild multipliers sum per line (matching the standalone). In the
        free game the whole spin win — lines and scatter together — is scaled by
        the current ladder multiplier and the free-game win scale.
        """
        self.win_data = Lines.get_lines(self.board, self.config, multiplier_method="symbol")
        Lines.record_lines_wins(self)
        line_total = self.win_data["totalWin"]

        scatter_total = self.evaluate_scatter_pays()

        if self.gametype == self.config.freegame_type:
            spin_win = (line_total + scatter_total) * self.global_multiplier * self.config.free_win_scale
        else:
            spin_win = line_total + scatter_total

        self.win_manager.update_spinwin(round(spin_win, 6))
        Lines.emit_linewin_events(self)

    def evaluate_scatter_pays(self) -> float:
        """Scatter pays by count, in total-bet units (0 below the trigger min)."""
        count = self.count_special_symbols("scatter")
        return float(self.config.scatter_paytable.get(count, 0.0))

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

    def bump_ladder(self) -> None:
        """Advance the global-multiplier ladder after any winning free spin."""
        if self.win_manager.spin_win > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier = min(
                self.config.ladder_max, self.global_multiplier + self.config.ladder_step
            )
