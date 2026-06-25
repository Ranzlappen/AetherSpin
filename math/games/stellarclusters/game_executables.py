"""Reusable executable steps for Stellar Clusters (official math-sdk path).

Thin orchestration that calls into ``game_calculations`` for the cluster numbers
and ``game_events`` for the payload shapes. The emission shape is kept identical
to the standalone engine (``math/simulator/engine.py`` + ``ClusterMechanic``):
one batched ``clusterWins`` per base board, and one ``freeSpinResult`` per
*winning* free spin — so both math paths produce books the frontend replays from
the same ``BookEvent`` contract.
"""

from game_calculations import GameCalculations
from game_events import (
    cluster_wins_event,
    freespin_end_event,
    freespin_result_event,
    freespin_retrigger_event,
    freespin_trigger_event,
    ladder_step_event,
    reveal_event,
    scatter_event,
)


class GameExecutables(GameCalculations):
    def draw_board(self):
        """Draw a board from the active reel set and emit a reveal event."""
        self.board, self.reel_positions = self.create_board_reelstrips()
        self.book.add_event(reveal_event(self))

    def _cluster_wins(self, global_mult: int = 1):
        """Return (wins, cluster_total) with per-win payout already computed.

        Cluster games have no per-line division; the stake covers the whole
        board, so the payout is ``paytable[size] * wild_mult * global_mult``.
        """
        wins = []
        cluster_total = 0.0
        for win in self.get_cluster_wins(self.board):
            payout = win["amount"] * win["wild_mult"] * global_mult
            wins.append({**win, "amount": payout})
            cluster_total += payout
        return wins, cluster_total

    def _scatter(self):
        count = self.count_special_symbol(self.board, self.scatter_symbol)
        amount = self.config.scatter_paytable.get(count, 0.0)
        self.last_scatter_count = count
        return count, amount

    def evaluate_base_board(self):
        """Base-game evaluation: emit one batched ``clusterWins`` + optional scatter."""
        wins, cluster_total = self._cluster_wins(global_mult=1)
        if wins:
            self.book.add_event(cluster_wins_event(wins, cluster_total, "base"))
        count, samount = self._scatter()
        if samount > 0:
            self.book.add_event(scatter_event(count, samount))
        self.win_manager.update_spinwin(cluster_total + samount)

    def check_freespin_entry(self) -> bool:
        if self.last_scatter_count >= self.config.scatter_min:
            self.tot_fs = self.config.freespin_awards[self.last_scatter_count]
            self.book.add_event(
                freespin_trigger_event(self.last_scatter_count, self.tot_fs, self.global_multiplier)
            )
            return True
        return False

    def run_free_spin(self):
        """One free spin: draw, reveal, then evaluate and emit a ``freeSpinResult``
        (only on a winning spin). Stellar Clusters has no expanding wilds, so the
        reveal carries the drawn board directly."""
        self.fs += 1
        self.board, self.reel_positions = self.create_board_reelstrips()
        self.book.add_event(reveal_event(self, expanded_reels=[]))
        wins, cluster_total = self._cluster_wins(global_mult=1)
        count, samount = self._scatter()
        spin_win = (cluster_total + samount) * self.global_multiplier * self.config.free_win_scale
        if wins or samount > 0:
            scatter_payload = {"count": count, "amount": round(samount, 6)} if samount > 0 else None
            self.book.add_event(
                freespin_result_event(self.fs, wins, scatter_payload, self.global_multiplier, spin_win)
            )
        self.win_manager.update_spinwin(spin_win)
        self.free_total += spin_win

        # Escalating multiplier ladder: bump on any winning spin (flat for this game).
        if (cluster_total + samount) > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier += self.config.ladder_step
            self.book.add_event(ladder_step_event(self.global_multiplier))

        # Retrigger: more scatters award additional spins (disabled for this game).
        if self.config.freespin_retrigger and self.last_scatter_count >= self.config.scatter_min:
            extra = self.config.freespin_awards[self.last_scatter_count]
            self.tot_fs += extra
            self.book.add_event(freespin_retrigger_event(self.last_scatter_count, extra, self.tot_fs))

    def emit_freespin_end(self):
        self.book.add_event(freespin_end_event(self.free_total))
