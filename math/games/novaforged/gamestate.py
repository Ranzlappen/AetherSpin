"""NovaForged simulation state for the official math-sdk (real API).

Drives the run loops and emits the shared `BookEvent` contract in the same order
as the standalone engine (`math/simulator/engine.py`), so the certified SDK books
replay on the same frontend:

* base game: `reveal` → `lineWins`? → `scatterWin`? → [free game] → `finalWin`;
* free game: `freeSpinTrigger`, then per spin `reveal` → `freeSpinResult`? →
  `ladderStep`? → `freeSpinRetrigger`?, then `freeSpinEnd`.
"""

from game_override import GameStateOverride
import game_events as ev


class GameState(GameStateOverride):
    """Handles game logic and events for a single simulation/round."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board(emit_event=False)

            self.evaluate_board_wins()
            ev.reveal_event(self, self.config.basegame_type)
            if self.contract_line_wins:
                ev.line_wins_event(self, self.config.basegame_type)
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
            self.expand_wilds()
            # Expansion overwrites cells (incl. scatters) — rescan before paying.
            self.get_special_symbols_on_board()

            self.evaluate_board_wins()
            ev.reveal_event(self, self.config.freegame_type, spin=self.fs, spins_total=self.tot_fs)
            if self.contract_line_wins or self.contract_scatter:
                ev.free_spin_result_event(self, self.fs)
            self.contract_free_total += self.win_manager.spin_win

            if self.bump_ladder():
                ev.ladder_step_event(self)

            if self.check_fs_condition():
                self.update_fs_retrigger_amt()

            self.win_manager.update_gametype_wins(self.gametype)
        self.end_freespin()
