"""NovaForged simulation state — entry point for a single simulated round.

Mirrors the official math-sdk ``games/template/gamestate.py`` contract: the SDK
calls :meth:`run_spin` once per simulation. All reusable mechanics live in the
``GameStateOverride`` / executables / calculations mixins below.
"""

from game_override import GameStateOverride


class GameState(GameStateOverride):
    """Handle all game logic and event updates for a given simulation number."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board()  # base-game board using the active reel set

            self.evaluate_lines_board()  # line wins with wild substitution
            self.evaluate_scatters()     # scatter pays + free-spin trigger check

            if self.check_freespin_entry():
                self.run_freespin()

            self.evaluate_finalwin()

        self.imprint_wins()

    def run_freespin(self):
        self.reset_fs_spin()
        while self.fs < self.tot_fs:
            self.update_freespin()       # advance counter, emit update event
            self.draw_board()
            self.apply_expanding_wilds()  # middle-reel wilds expand
            self.evaluate_lines_board(global_mult=self.global_multiplier)
            self.evaluate_scatters()
            self.update_multiplier_ladder()  # bump global multiplier on a win
            self.check_freespin_retrigger()

        self.end_freespin()
