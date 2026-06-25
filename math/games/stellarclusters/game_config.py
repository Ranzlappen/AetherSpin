"""Stellar Clusters game configuration for the official StakeEngine math-sdk.

Written against the official ``StakeEngine/math-sdk`` API (the same ``Config`` /
``BetMode`` / ``Distribution`` primitives as ``games/template``). Runnable once
the SDK is present — run ``bash scripts/setup-math.sh`` which clones the SDK into
``math/engine/`` and links ``math/games/*`` into ``math/engine/games/``.

Numeric values (paytable, reels, RTP target, wincap, features) are kept in
lock-step with the canonical ``shared/games/stellarclusters/game-definition.json``
— ``_load_shared_definition`` reads it so the standalone engine and certified SDK
agree. Stellar Clusters is a cluster-pays game: ``win_type = "cluster"``, the
``paylines`` map is empty, and the paytable is keyed by connected-group size.
"""

from __future__ import annotations

import json
import os

from src.config.config import Config, BetMode  # type: ignore
from src.config.distributions import Distribution  # type: ignore


def _load_shared_definition() -> dict:
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "shared_definition.json"),
        os.path.normpath(
            os.path.join(here, "..", "..", "..", "shared", "games", "stellarclusters", "game-definition.json")
        ),
        os.path.normpath(os.path.join(here, "..", "..", "shared", "games", "stellarclusters", "game-definition.json")),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("Could not locate shared game-definition.json for Stellar Clusters")


class GameConfig(Config):
    """Stellar Clusters — 5x3, cluster-pays neon-cosmic slot."""

    def __init__(self) -> None:
        super().__init__()
        d = _load_shared_definition()
        eng = d["engine"]

        self.game_id = "stellarclusters"
        self.provider_number = 1
        self.working_name = "Stellar Clusters"
        self.wincap = float(eng["wincapMultiplier"])
        self.win_type = "cluster"
        self.rtp = float(eng["rtpTarget"])
        self.construct_paths()

        # Board dimensions
        self.num_reels = int(eng["numReels"])
        self.num_rows = [int(eng["numRows"])] * self.num_reels

        # Paytable: SDK expects {(size, symbol): payout} — for cluster pays the
        # leading key is the connected-group size rather than an N-of-a-kind run.
        self.paytable = {}
        for sym, pays in d["paytable"].items():
            for size, value in pays.items():
                self.paytable[(int(size), sym)] = float(value)

        self.include_padding = True
        self.special_symbols = {
            "wild": [s["id"] for s in d["symbols"] if s["kind"] == "wild"],
            "scatter": [d["scatter"]["symbol"]],
            "multiplier": [s["id"] for s in d["symbols"] if s["kind"] == "wild"],
        }

        # Cluster games have no fixed paylines.
        self.paylines = {i: line for i, line in enumerate(d["paylines"])}

        awards = {int(k): int(v) for k, v in d["features"]["freeSpins"]["awards"].items()}
        self.freespin_triggers = {
            self.basegame_type: awards,
            self.freegame_type: awards,
        }
        self.anticipation_triggers = {
            self.basegame_type: d["scatter"]["minToTrigger"] - 1,
            self.freegame_type: d["scatter"]["minToTrigger"] - 1,
        }

        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv"}
        self.reels = {}
        for name, fname in reels.items():
            self.reels[name] = self.read_reels_csv(os.path.join(self.reels_path, fname))

        # --- Convenience attributes used by our calculation/executable layers ---
        self.wild_symbol = self.special_symbols["wild"][0]
        self.num_paylines = len(self.paylines)
        self.symbol_paytable = {sym: {int(c): float(v) for c, v in pays.items()} for sym, pays in d["paytable"].items()}
        self.scatter_paytable = {int(c): float(v) for c, v in d["scatter"]["pays"].items()}
        self.scatter_min = int(d["scatter"]["minToTrigger"])
        self.freespin_awards = awards
        self.freespin_retrigger = bool(d["features"]["freeSpins"]["retrigger"])
        ladder = d["features"]["freeSpins"]["multiplierLadder"]
        self.ladder_start = int(ladder["start"])
        self.ladder_step = int(ladder["step"])
        self.ladder_max = int(ladder["max"])
        self.free_win_scale = float(d["features"]["freeSpins"].get("winScale", 1.0))
        self.mult_wild_values = [int(v) for v in d["features"]["multiplierWilds"]["values"]]
        self.mult_wild_weights = [int(w) for w in d["features"]["multiplierWilds"]["weights"]]
        self.expanding_wilds = bool(d["features"]["expandingWilds"]["enabled"])

        self.bet_modes = [
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=self._base_distributions(),
            ),
            BetMode(
                name="bonus",
                cost=float(d["features"]["bonusBuy"]["costMultiplier"]),
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=self._bonus_distributions(),
            ),
        ]

    # ------------------------------------------------------------------ #
    def _base_distributions(self) -> list:
        return [
            Distribution(
                criteria="wincap",
                quota=0.001,
                win_criteria=self.wincap,
                conditions={
                    "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                    "force_wincap": True,
                    "force_freegame": True,
                },
            ),
            Distribution(
                criteria="freegame",
                quota=0.1,
                conditions={
                    "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                    "force_wincap": False,
                    "force_freegame": True,
                },
            ),
            Distribution(
                criteria="0",
                quota=0.45,
                win_criteria=0.0,
                conditions={"reel_weights": {self.basegame_type: {"BR0": 1}}, "force_wincap": False, "force_freegame": False},
            ),
            Distribution(
                criteria="basegame",
                quota=0.45,
                conditions={"reel_weights": {self.basegame_type: {"BR0": 1}}, "force_wincap": False, "force_freegame": False},
            ),
        ]

    def _bonus_distributions(self) -> list:
        return [
            Distribution(
                criteria="wincap",
                quota=0.002,
                win_criteria=self.wincap,
                conditions={
                    "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                    "force_wincap": True,
                    "force_freegame": True,
                },
            ),
            Distribution(
                criteria="freegame",
                quota=0.998,
                conditions={
                    "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                    "force_wincap": False,
                    "force_freegame": True,
                },
            ),
        ]
