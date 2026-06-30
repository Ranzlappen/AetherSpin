"""Stellar Clusters simulation state for the official math-sdk (real API).

Emits the shared `BookEvent` contract in the same order as the standalone engine.
Generic across the AetherSpin mechanics: expanding wilds (no-op when disabled),
the multiplier ladder (no-op when flat), scatter retriggers (skipped when the
game has no free-game trigger table). Stellar Clusters disables expanding/multiplier
wilds and uses a flat ladder, so the free game is cluster + scatter, win-scaled.
"""

from game_override import GameStateOverride
import game_events as ev


class GameState(GameStateOverride):
    """Handles game logic and events for a single simulation/round."""

    def run_sims(self, *args, **kwargs):
        # SDK bug workaround: clear the per-mode payout sidecar so the bonus
        # verification sidecar isn't polluted by the base run (see ADR 0005).
        self._payout_ints = []
        return super().run_sims(*args, **kwargs)

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board(emit_event=False)

            self.evaluate_board_wins()
            ev.reveal_event(self, self.config.basegame_type)
            if self.contract_wins:
                ev.win_event(self, self.config.basegame_type)
            if self.contract_scatter:
                ev.scatter_win_event(self)
            self.win_manager.update_gametype_wins(self.gametype)

            if self.check_fs_condition():
                self.run_freespin_from_base()

            self.evaluate_finalwin()
            self.check_repeat()
        self.imprint_wins()

    def run_freespin(self):
        self.reset_fs_spin()
        while self.fs < self.tot_fs and not self.wincap_triggered:
            self.update_freespin()
            self.draw_board(emit_event=False)
            self.expand_wilds()  # no-op when expanding wilds are disabled
            self.get_special_symbols_on_board()

            self.evaluate_board_wins()
            ev.reveal_event(self, self.config.freegame_type, spin=self.fs, spins_total=self.tot_fs)
            if self.contract_wins or self.contract_scatter:
                ev.free_spin_result_event(self, self.fs)
            self.contract_free_total += self.win_manager.spin_win

            if self.bump_ladder():
                ev.ladder_step_event(self)

            # Retrigger only when the game defines a free-game trigger table.
            if self.config.freegame_type in self.config.freespin_triggers and self.check_fs_condition():
                self.update_fs_retrigger_amt()

            self.win_manager.update_gametype_wins(self.gametype)
        self.end_freespin()
