"""Typed loader for the shared game-definition.json single source of truth."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Repo-root relative location of the canonical game definitions.
SHARED_GAMES_DIR = Path(__file__).resolve().parents[2] / "shared" / "games"


@dataclass
class GameDefinition:
    """In-memory view over a game's canonical JSON definition.

    The same file is consumed by the TypeScript frontend, so this class
    deliberately keeps the raw dict accessible via :attr:`raw` while exposing
    typed convenience accessors for the math engine.
    """

    raw: dict[str, Any]

    @property
    def id(self) -> str:
        return self.raw["id"]

    @property
    def num_reels(self) -> int:
        return int(self.raw["engine"]["numReels"])

    @property
    def num_rows(self) -> int:
        return int(self.raw["engine"]["numRows"])

    @property
    def wincap(self) -> float:
        return float(self.raw["engine"]["wincapMultiplier"])

    @property
    def rtp_target(self) -> float:
        return float(self.raw["engine"]["rtpTarget"])

    @property
    def paylines(self) -> list[list[int]]:
        return [list(map(int, line)) for line in self.raw["paylines"]]

    @property
    def num_paylines(self) -> int:
        return len(self.raw["paylines"])

    @property
    def paytable(self) -> dict[str, dict[int, float]]:
        out: dict[str, dict[int, float]] = {}
        for sym, pays in self.raw["paytable"].items():
            out[sym] = {int(k): float(v) for k, v in pays.items()}
        return out

    @property
    def wild(self) -> str:
        for s in self.raw["symbols"]:
            if s["kind"] == "wild":
                return s["id"]
        raise ValueError("No wild symbol defined")

    @property
    def scatter(self) -> str:
        return self.raw["scatter"]["symbol"]

    @property
    def scatter_min(self) -> int:
        return int(self.raw["scatter"]["minToTrigger"])

    @property
    def scatter_pays(self) -> dict[int, float]:
        return {int(k): float(v) for k, v in self.raw["scatter"]["pays"].items()}

    @property
    def freespin_awards(self) -> dict[int, int]:
        awards = self.raw["features"]["freeSpins"]["awards"]
        return {int(k): int(v) for k, v in awards.items()}

    @property
    def free_win_scale(self) -> float:
        """Tuning knob applied to free-spin payouts only, used to balance the
        buy-bonus RTP independently of the base-game RTP."""
        return float(self.raw["features"]["freeSpins"].get("winScale", 1.0))

    @property
    def multiplier_ladder(self) -> dict[str, int]:
        ladder = self.raw["features"]["freeSpins"]["multiplierLadder"]
        return {"start": int(ladder["start"]), "step": int(ladder["step"]), "max": int(ladder["max"])}

    @property
    def mult_wild_values(self) -> list[int]:
        return [int(v) for v in self.raw["features"]["multiplierWilds"]["values"]]

    @property
    def mult_wild_weights(self) -> list[int]:
        return [int(w) for w in self.raw["features"]["multiplierWilds"]["weights"]]

    @property
    def expanding_wilds(self) -> bool:
        return bool(self.raw["features"]["expandingWilds"]["enabled"])

    @property
    def bet_modes(self) -> list[dict[str, Any]]:
        return list(self.raw["betModes"])

    def symbol_ids(self) -> list[str]:
        return [s["id"] for s in self.raw["symbols"]]


def load_definition(game_id: str, base_dir: Path | None = None) -> GameDefinition:
    """Load ``<base_dir>/<game_id>/game-definition.json`` into a GameDefinition."""
    base = base_dir or SHARED_GAMES_DIR
    path = Path(base) / game_id / "game-definition.json"
    with open(path, "r", encoding="utf-8") as f:
        return GameDefinition(raw=json.load(f))
