"""NovaForged simulation state for the official math-sdk (real API).

Mirrors the SDK's `0_0_lines` run loop. NovaForged's extras (scatter pays,
expanding wilds, the global-multiplier ladder, and the free-game win scale) are
layered in through the executables/override so the certified RTP tracks the
standalone (`math/simulator/engine.py`). Free-game multiplier wilds use the
SDK's native realized-multiplier mechanism (Symbol `multiplier` attribute).
"""

from game_override import GameStateOverride


class GameState(GameStateOverride):
    """Handles game logic and events for a single simulation/round."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board()

            self.evaluate_lines_board()
            self.win_manager.update_gametype_wins(self.gametype)

            if self.check_fs_condition():
                self.run_freespin_from_base()

            self.evaluate_finalwin()
            self.check_repeat()
        self.imprint_wins()

    def run_freespin(self):
        self.reset_fs_spin()
        while self.fs < self.tot_fs:
            self.update_freespin()
            self.draw_board()

            self.evaluate_lines_board()

            if self.check_fs_condition():
                self.update_fs_retrigger_amt()

            self.win_manager.update_gametype_wins(self.gametype)
        self.end_freespin()
