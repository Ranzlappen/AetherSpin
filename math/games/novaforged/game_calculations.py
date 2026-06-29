"""NovaForged calculation layer (real math-sdk API).

Inherits the SDK's `Executables` (board drawing, free-spin lifecycle, win
manager, event helpers); NovaForged-specific calculations are added here as the
port grows. Mirrors `0_0_lines/game_calculations.py`.
"""

from src.executables.executables import Executables  # type: ignore


class GameCalculations(Executables):
    pass
