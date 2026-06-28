"""State initialisation and per-round resets for NovaForged.

Bridges the SDK ``GeneralGameState`` with our executables. Derives convenience
attributes from :class:`GameConfig` and resets feature state between rounds.
"""

from game_executables import GameExecutables
from src.state.state import GeneralGameState  # type: ignore  # provided by the SDK


class GameStateOverride(GameExecutables, GeneralGameState):
    def __init__(self, config):
        super().__init__(config)
        self.config = config
        self.wild_symbol = config.special_symbols["wild"][0]
        self.scatter_symbol = config.special_symbols["scatter"][0]
        self.scatter_min = config.scatter_min
        # Free-game multiplier wilds are realized per cell at evaluation time
        # (see game_calculations.sample_multiplier_grid), mirroring the
        # standalone engine — no averaged approximation is precomputed here.

    def reset_book(self):
        super().reset_book()
        self.in_freegame = False
        self.global_multiplier = self.config.ladder_start
        self.last_scatter_count = 0
        self.tot_fs = 0
        self.fs = 0

    def reset_fs_spin(self):
        self.in_freegame = True
        self.fs = 0
        self.global_multiplier = self.config.ladder_start
        self.free_total = 0.0

    def end_freespin(self):
        self.in_freegame = False
