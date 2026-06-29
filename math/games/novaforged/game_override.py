"""Per-round state + special-symbol functions for NovaForged (real SDK API).

Modelled on `0_0_lines`/`0_0_expwilds`: the wild symbol carries a realized
`multiplier` attribute in the free game (the SDK's native multiplier-wild
mechanism), and `check_repeat` enforces the distribution win criteria.
"""

from game_executables import GameExecutables
from src.calculations.statistics import get_random_outcome  # type: ignore


class GameStateOverride(GameExecutables):
    def reset_book(self):
        super().reset_book()
        # NovaForged free-game state.
        self.global_multiplier = self.config.ladder_start
        self.expanding_wild_reels = []

    def reset_fs_spin(self):
        super().reset_fs_spin()
        self.global_multiplier = self.config.ladder_start
        self.expanding_wild_reels = []

    def assign_special_sym_function(self):
        # The wild realizes a multiplier (free game only); see assign_mult_property.
        self.special_symbol_functions = {self.config.wild_symbol: [self.assign_mult_property]}

    def assign_mult_property(self, symbol):
        """Realize a per-cell wild multiplier in the free game (1 in the base game)."""
        multiplier_value = 1
        if self.gametype == self.config.freegame_type:
            multiplier_value = get_random_outcome(
                self.get_current_distribution_conditions()["mult_values"][self.gametype]
            )
        symbol.assign_attribute({"multiplier": multiplier_value})

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
