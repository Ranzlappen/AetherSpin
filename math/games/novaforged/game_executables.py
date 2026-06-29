"""Reusable executable steps for NovaForged (real math-sdk API).

Modelled on `0_0_lines`: evaluate the paylines, record + emit the win events,
and bank the spin win. NovaForged's extra free-game mechanics (scatter pays,
expanding wilds, ladder, win scale) are layered on in later iterations.
"""

from game_calculations import GameCalculations
from src.calculations.lines import Lines  # type: ignore


class GameExecutables(GameCalculations):
    def evaluate_lines_board(self):
        """Populate win-data, record wins, bank the spin win, emit events."""
        self.win_data = Lines.get_lines(self.board, self.config, global_multiplier=self.global_multiplier)
        Lines.record_lines_wins(self)
        self.win_manager.update_spinwin(self.win_data["totalWin"])
        Lines.emit_linewin_events(self)
