"""Per-round state, special-symbol functions, and contract-event lifecycle
overrides for NovaForged (real SDK API).

The wild carries a realized `multiplier` attribute in the free game (the SDK's
native multiplier-wild mechanism). The free-spin lifecycle methods are overridden
so they emit the shared `BookEvent` vocabulary (`game_events.py`) instead of the
SDK's native events — the certified books must be replayable by the same frontend
that replays the standalone engine's books.
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
        self.contract_line_wins = []
        self.contract_line_total = 0.0
        self.contract_scatter = None
        self.contract_free_total = 0.0

    def reset_fs_spin(self):
        super().reset_fs_spin()
        self.global_multiplier = self.config.ladder_start
        self.expanding_wild_reels = []
        self.contract_free_total = 0.0

    # ---- realized multiplier wilds ----------------------------------------
    def assign_special_sym_function(self):
        self.special_symbol_functions = {self.config.wild_symbol: [self.assign_mult_property]}

    def assign_mult_property(self, symbol):
        """Realize a per-cell wild multiplier in the free game (1 in the base game)."""
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
        """Set the initial free-spin count and emit the contract trigger."""
        count = self.count_special_symbols(scatter_key)
        self.tot_fs = self._award_for(count)
        ev.free_spin_trigger_event(self, count, self.tot_fs, self.config.ladder_start)

    def update_fs_retrigger_amt(self, scatter_key: str = "scatter") -> None:
        """Award extra spins on retrigger and emit the contract retrigger."""
        count = self.count_special_symbols(scatter_key)
        awarded = self._award_for(count)
        self.tot_fs += awarded
        ev.free_spin_retrigger_event(self, count, awarded, self.tot_fs)

    def update_freespin(self) -> None:
        """Per free-spin bookkeeping (no SDK event; our reveal carries progress)."""
        self.fs += 1
        self.win_manager.reset_spin_win()
        self.win_data = {}

    def end_freespin(self) -> None:
        ev.free_spin_end_event(self, self.contract_free_total)

    @staticmethod
    def _quantize_payout(x: float) -> float:
        """Round a payout to 10-cent (0.1x) increments.

        Stake's RGS verification (`utils/rgs_verification.verify_lookup_format`)
        requires every lookup-table payout to be a non-negative integer divisible
        by 10 (book units = multiplier × 100), with the minimum non-zero payout
        being 10 (0.1x). Our shared paytable, divided to per-line units, produces
        sub-cent payouts, so the round total is rounded (half-up) to the nearest
        0.1x here — the single, certified place a payout is quantized.
        """
        cents = int(round(x * 100))
        tens = (cents + 5) // 10
        return (tens * 10) / 100.0

    def update_final_win(self) -> None:
        """Quantize the round payout to 0.1x and keep the base/free split
        consistent (overrides the SDK so certified payouts pass RGS verification).
        """
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
        """Set the payout multiplier (SDK bookkeeping) and emit the contract
        finalWin."""
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
