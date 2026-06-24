"""Reusable executable steps for NovaForged (official math-sdk path).

Thin orchestration that calls into ``game_calculations`` for the numbers and
``game_events`` for the payload shapes. The emission shape is kept identical to
the standalone engine (``math/simulator/engine.py``): one batched ``lineWins`` per
base board, and one ``freeSpinResult`` per *winning* free spin — so both math
paths produce books the frontend can replay from the same ``BookEvent`` contract.
"""

from game_calculations import GameCalculations
from game_events import (
    freespin_end_event,
    freespin_result_event,
    freespin_retrigger_event,
    freespin_trigger_event,
    ladder_step_event,
    line_wins_event,
    reveal_event,
    scatter_event,
)


class GameExecutables(GameCalculations):
    def draw_board(self):
        """Draw a board from the active reel set and emit a reveal event."""
        self.board, self.reel_positions = self.create_board_reelstrips()
        self.book.add_event(reveal_event(self))

    def _line_wins(self, global_mult: int = 1):
        """Return (wins, line_total) with per-win payout already computed."""
        wins = []
        line_total = 0.0
        for win in self.get_line_wins(self.board):
            payout = (win["amount"] / self.config.num_paylines) * win["wild_mult"] * global_mult
            wins.append({**win, "amount": payout})
            line_total += payout
        return wins, line_total

    def _scatter(self):
        count = self.count_special_symbol(self.board, self.scatter_symbol)
        amount = self.config.scatter_paytable.get(count, 0.0)
        self.last_scatter_count = count
        return count, amount

    def evaluate_base_board(self):
        """Base-game evaluation: emit one batched ``lineWins`` + optional scatter."""
        wins, line_total = self._line_wins(global_mult=1)
        if wins:
            self.book.add_event(line_wins_event(wins, line_total, "base"))
        count, samount = self._scatter()
        if samount > 0:
            self.book.add_event(scatter_event(count, samount))
        self.win_manager.update_spinwin(line_total + samount)

    def check_freespin_entry(self) -> bool:
        if self.last_scatter_count >= self.config.scatter_min:
            self.tot_fs = self.config.freespin_awards[self.last_scatter_count]
            self.book.add_event(
                freespin_trigger_event(self.last_scatter_count, self.tot_fs, self.global_multiplier)
            )
            return True
        return False

    def run_free_spin(self):
        """One free spin: draw, expand wilds, reveal the post-expansion board, then
        evaluate and emit a ``freeSpinResult`` (only on a winning spin).

        Ordering mirrors the standalone engine (``math/simulator/engine.py``): wilds
        expand *before* the reveal so the reveal carries the final board and
        ``expandedReels``, and an empty spin emits no ``freeSpinResult``.
        """
        self.fs += 1
        self.board, self.reel_positions = self.create_board_reelstrips()
        expanded = self.apply_expanding_wilds()
        self.book.add_event(reveal_event(self, expanded_reels=expanded))
        wins, line_total = self._line_wins(global_mult=1)
        count, samount = self._scatter()
        spin_win = (line_total + samount) * self.global_multiplier * self.config.free_win_scale
        if wins or samount > 0:
            scatter_payload = {"count": count, "amount": round(samount, 6)} if samount > 0 else None
            self.book.add_event(
                freespin_result_event(self.fs, wins, scatter_payload, self.global_multiplier, spin_win)
            )
        self.win_manager.update_spinwin(spin_win)
        self.free_total += spin_win

        # Escalating multiplier ladder: bump on any winning spin.
        if (line_total + samount) > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier += self.config.ladder_step
            self.book.add_event(ladder_step_event(self.global_multiplier))

        # Retrigger: more scatters award additional spins.
        if self.last_scatter_count >= self.config.scatter_min:
            extra = self.config.freespin_awards[self.last_scatter_count]
            self.tot_fs += extra
            self.book.add_event(freespin_retrigger_event(self.last_scatter_count, extra, self.tot_fs))

    def emit_freespin_end(self):
        self.book.add_event(freespin_end_event(self.free_total))
