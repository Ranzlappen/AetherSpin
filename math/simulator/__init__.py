"""AetherSpin standalone math engine.

A lightweight, dependency-light Monte-Carlo slot simulator that runs directly
from the shared ``game-definition.json`` single source of truth. It exists so
the monorepo is runnable out-of-the-box (local dev, CI math validation, RTP
reporting and RGS-compatible book/lookup-table generation) WITHOUT first
cloning the heavy official ``StakeEngine/math-sdk``.

For final certification submissions the official SDK remains the canonical,
certified path (see ``math/games/novaforged`` + ``scripts/setup-math.sh``).
This engine is intentionally written to produce the same library output shape
(``books_<mode>.jsonl``, ``lookUpTable_<mode>.csv``, ``index.json``,
``config.json``) so the two pipelines stay interchangeable.
"""

from .definition import GameDefinition, load_definition
from .engine import LinesEngine, SlotEngine, SpinResult
from .mechanics import LinesMechanic, WinMechanic, build_mechanic, register_mechanic
from .reels import ReelSet, load_reelset

__all__ = [
    "GameDefinition",
    "load_definition",
    "SlotEngine",
    "LinesEngine",
    "SpinResult",
    "WinMechanic",
    "LinesMechanic",
    "build_mechanic",
    "register_mechanic",
    "ReelSet",
    "load_reelset",
]
