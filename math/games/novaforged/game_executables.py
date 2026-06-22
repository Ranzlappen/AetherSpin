"""Reusable executable steps for NovaForged.

These wrap the official math-sdk board/evaluation primitives. They are written
to slot into the SDK's ``Executables`` base (board drawing, win evaluation,
event emission). Keep this layer thin: pure orchestration that calls into
``game_calculations`` for the numbers and ``game_events`` for the payload shapes.
"""

from game_calculations import GameCalculations
from game_events import (
    reveal_event,
    win_info_event,
    scatter_event,
    freespin_trigger_event,
    freespin_update_event,
    ladder_step_event,
)


class GameExecutables(GameCalculations):
    def draw_board(self):
        """Draw a board from the active reel set and emit a reveal event."""
        self.board, self.reel_positions = self.create_board_reelstrips()
        self.book.add_event(reveal_event(self))

    def evaluate_lines_board(self, global_mult: int = 1):
        """Evaluate all paylines left-to-right with wild substitution."""
        wins = self.get_line_wins(self.board)
        line_total = 0.0
        for win in wins:
            payout = (win["amount"] / self.config.num_paylines) * win["wild_mult"] * global_mult
            line_total += payout
            self.book.add_event(win_info_event(self, win, payout))
        self.win_manager.update_spinwin(line_total)

    def evaluate_scatters(self):
        count = self.count_special_symbol(self.board, self.scatter_symbol)
        amount = self.config.scatter_paytable.get(count, 0.0)
        if amount > 0:
            self.win_manager.update_spinwin(amount)
            self.book.add_event(scatter_event(self, count, amount))
        self.last_scatter_count = count

    def check_freespin_entry(self) -> bool:
        if self.last_scatter_count >= self.config.scatter_min:
            self.tot_fs = self.config.freespin_awards[self.last_scatter_count]
            self.book.add_event(freespin_trigger_event(self, self.last_scatter_count, self.tot_fs))
            return True
        return False

    def update_freespin(self):
        self.fs += 1
        self.book.add_event(freespin_update_event(self))

    def update_multiplier_ladder(self):
        if self.win_manager.spin_win > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier += self.config.ladder_step
            self.book.add_event(ladder_step_event(self))

    def check_freespin_retrigger(self):
        if self.last_scatter_count >= self.config.scatter_min:
            extra = self.config.freespin_awards[self.last_scatter_count]
            self.tot_fs += extra
            self.book.add_event(freespin_trigger_event(self, self.last_scatter_count, extra, retrigger=True))
