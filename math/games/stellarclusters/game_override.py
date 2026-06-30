"""Per-round state, special-symbol functions, and contract-event lifecycle
overrides for Stellar Clusters (real SDK API).

Generic across the AetherSpin games (lines/ways/cluster): emits the shared
`BookEvent` vocabulary instead of the SDK's native events, quantizes the round
payout to 0.1x for RGS conformance, and keeps the win-manager bookkeeping intact.
Multiplier wilds are disabled for this game (values == [1]).
"""

from game_executables import GameExecutables
from src.calculations.statistics import get_random_outcome  # type: ignore

import game_events as ev


class GameStateOverride(GameExecutables):
    # ---- per-round / per-spin resets --------------------------------------
    def reset_book(self):
        super().reset_book()
        self.global_multiplier = self.config.ladder_start
        self.expanding_wild_reels = []
        self.contract_wins = []
        self.contract_win_total = 0.0
        self.contract_scatter = None
        self.contract_free_total = 0.0

    def reset_fs_spin(self):
        super().reset_fs_spin()
        self.global_multiplier = self.config.ladder_start
        self.expanding_wild_reels = []
        self.contract_free_total = 0.0

    # ---- realized multiplier wilds (value 1 when disabled) ----------------
    def assign_special_sym_function(self):
        self.special_symbol_functions = {self.config.wild_symbol: [self.assign_mult_property]}

    def assign_mult_property(self, symbol):
        multiplier_value = 1
        if self.gametype == self.config.freegame_type:
            multiplier_value = get_random_outcome(
                self.get_current_distribution_conditions()["mult_values"][self.gametype]
            )
        symbol.assign_attribute({"multiplier": multiplier_value})

    # ---- free-spin lifecycle: emit the shared contract, not SDK events ----
    def _award_for(self, count: int) -> int:
        awards = self.config.freespin_triggers[self.gametype]
        return awards.get(count, awards[max(awards)])

    def update_freespin_amount(self, scatter_key: str = "scatter") -> None:
        count = self.count_special_symbols(scatter_key)
        self.tot_fs = self._award_for(count)
        ev.free_spin_trigger_event(self, count, self.tot_fs, self.config.ladder_start)

    def update_fs_retrigger_amt(self, scatter_key: str = "scatter") -> None:
        count = self.count_special_symbols(scatter_key)
        awarded = self._award_for(count)
        self.tot_fs += awarded
        ev.free_spin_retrigger_event(self, count, awarded, self.tot_fs)

    def update_freespin(self) -> None:
        self.fs += 1
        self.win_manager.reset_spin_win()
        self.win_data = {}

    def end_freespin(self) -> None:
        ev.free_spin_end_event(self, self.contract_free_total)

    # ---- payout quantization (RGS upload rule) ----------------------------
    @staticmethod
    def _quantize_payout(x: float) -> float:
        """Round a payout to 10-cent (0.1x) increments — Stake RGS requires
        lookup-table payouts divisible by 10 (book units = multiplier × 100)."""
        cents = int(round(x * 100))
        tens = (cents + 5) // 10
        return (tens * 10) / 100.0

    def update_final_win(self) -> None:
        final = min(self.win_manager.running_bet_win, self.config.wincap)
        base = min(self.win_manager.basegame_wins, self.config.wincap)
        final_q = self._quantize_payout(final)
        base_q = min(self._quantize_payout(base), final_q)
        free_q = round(final_q - base_q, 2)
        self.final_win = final_q
        self.book.payout_multiplier = final_q
        self.book.basegame_wins = base_q
        self.book.freegame_wins = free_q

    def evaluate_finalwin(self) -> None:
        self.update_final_win()
        ev.final_win_event(self)

    # ---- criteria enforcement ---------------------------------------------
    def check_repeat(self):
        super().check_repeat()
        if self.repeat is False:
            win_criteria = self.get_current_betmode_distributions().get_win_criteria()
            if win_criteria is not None and self.final_win != win_criteria:
                self.repeat = True
                return
            if win_criteria is None and self.final_win == 0:
                self.repeat = True
                return
