"""NovaForged simulation state for the official math-sdk (real API).

Mirrors the SDK's `0_0_lines`/`0_0_expwilds` run loops, layering NovaForged's
free-game mechanics on top so the certified math tracks the standalone
(`math/simulator/engine.py`):

* base game: line + scatter wins, free-game trigger on enough scatters;
* free game: expanding wilds on the middle reels, native realized multiplier
  wilds (summed per line), the escalating global-multiplier ladder, the
  free-game win scale, and scatter retriggers.
"""

from game_override import GameStateOverride
from src.events.events import reveal_event  # type: ignore


class GameState(GameStateOverride):
    """Handles game logic and events for a single simulation/round."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board()  # emits the base-game reveal

            self.evaluate_board_wins()
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
            self.draw_board(emit_event=False)
            self.expand_wilds()
            # Expansion overwrites cells (incl. scatters) — rescan before paying.
            self.get_special_symbols_on_board()
            reveal_event(self)

            self.evaluate_board_wins()

            if self.check_fs_condition():
                self.update_fs_retrigger_amt()

            self.win_manager.update_gametype_wins(self.gametype)
            self.bump_ladder()
        self.end_freespin()
