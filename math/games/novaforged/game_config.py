"""NovaForged game configuration for the official StakeEngine math-sdk.

This file is written against the official ``StakeEngine/math-sdk`` API (the same
``Config`` / ``BetMode`` / ``Distribution`` primitives used by ``games/template``
and ``games/0_0_lines``). It becomes runnable once the SDK is present — run
``bash scripts/setup-math.sh`` which clones the SDK into ``math/engine/`` and
links ``math/games/*`` into ``math/engine/games/``.

The numeric values (paytable, reels, RTP target, wincap) are kept in lock-step
with the canonical ``shared/games/novaforged/game-definition.json`` so the
standalone engine and the certified SDK agree. ``_load_shared_definition`` reads
that file to avoid drift.
"""

from __future__ import annotations

import json
import os

# These imports resolve when this file is executed inside the official math-sdk
# (see scripts/setup-math.sh). They are intentionally left as the SDK paths.
from src.config.config import Config, BetMode  # type: ignore
from src.config.distributions import Distribution  # type: ignore


def _load_shared_definition() -> dict:
    here = os.path.dirname(os.path.abspath(__file__))
    # When linked into the SDK, the shared/ dir is reachable via the repo root.
    candidates = [
        os.path.join(here, "shared_definition.json"),
        os.path.normpath(os.path.join(here, "..", "..", "..", "shared", "games", "novaforged", "game-definition.json")),
        os.path.normpath(os.path.join(here, "..", "..", "shared", "games", "novaforged", "game-definition.json")),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("Could not locate shared game-definition.json for NovaForged")


class GameConfig(Config):
    """NovaForged — 5x3, 20-line neon-cosmic slot."""

    def __init__(self) -> None:
        super().__init__()
        d = _load_shared_definition()
        eng = d["engine"]

        self.game_id = "novaforged"
        self.provider_number = 1
        self.working_name = "NovaForged"
        self.wincap = float(eng["wincapMultiplier"])
        self.win_type = "lines"
        self.rtp = float(eng["rtpTarget"])
        self.construct_paths()

        # Board dimensions
        self.num_reels = int(eng["numReels"])
        self.num_rows = [int(eng["numRows"])] * self.num_reels

        # Paytable: SDK expects {(count, symbol): payout}
        self.paytable = {}
        for sym, pays in d["paytable"].items():
            for count, value in pays.items():
                self.paytable[(int(count), sym)] = float(value)

        self.include_padding = True
        self.special_symbols = {
            "wild": [s["id"] for s in d["symbols"] if s["kind"] == "wild"],
            "scatter": [d["scatter"]["symbol"]],
            "multiplier": [s["id"] for s in d["symbols"] if s["kind"] == "wild"],
        }

        # Paylines
        self.paylines = {i: line for i, line in enumerate(d["paylines"])}

        # Free-spin triggers: number of scatters -> spins awarded
        awards = {int(k): int(v) for k, v in d["features"]["freeSpins"]["awards"].items()}
        self.freespin_triggers = {
            self.basegame_type: awards,
            self.freegame_type: awards,  # retrigger uses the same table
        }
        self.anticipation_triggers = {
            self.basegame_type: d["scatter"]["minToTrigger"] - 1,
            self.freegame_type: d["scatter"]["minToTrigger"] - 1,
        }

        # Reel strips (CSV files live alongside this config)
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
        ladder = d["features"]["freeSpins"]["multiplierLadder"]
        self.ladder_start = int(ladder["start"])
        self.ladder_step = int(ladder["step"])
        self.ladder_max = int(ladder["max"])
        self.free_win_scale = float(d["features"]["freeSpins"].get("winScale", 1.0))
        self.mult_wild_values = [int(v) for v in d["features"]["multiplierWilds"]["values"]]
        self.mult_wild_weights = [int(w) for w in d["features"]["multiplierWilds"]["weights"]]
        self.expanding_wilds = bool(d["features"]["expandingWilds"]["enabled"])

        # Bet modes — base game and bonus buy
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
