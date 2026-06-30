"""Cosmic Ways config for the official StakeEngine math-sdk (real API).

Ported to the current SDK `Config` API (see ADR 0005), modelled on NovaForged
and the SDK's `0_0_ways` example. Numbers are loaded from the canonical
`shared/games/cosmicways/game-definition.json`.

Mechanic: 5x3 all-ways (243 ways), free-spin scatter trigger with a flat
multiplier and a free-game win scale. Multiplier wilds and expanding wilds are
disabled for this game (definition: `multiplierWilds.values == [1]`,
`expandingWilds.enabled == false`), so the free game is ways + scatter pays,
scaled by `features.freeSpins.winScale`.
"""

import json
import os

from src.config.config import Config  # type: ignore
from src.config.distributions import Distribution  # type: ignore
from src.config.betmode import BetMode  # type: ignore


def _load_shared_definition() -> dict:
    here = os.path.dirname(os.path.realpath(__file__))  # realpath: resolve the SDK symlink so shared/ is found
    candidates = [
        os.path.normpath(os.path.join(here, "..", "..", "..", "shared", "games", "cosmicways", "game-definition.json")),
        os.path.normpath(os.path.join(here, "..", "..", "shared", "games", "cosmicways", "game-definition.json")),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("Could not locate shared game-definition.json for Cosmic Ways")


class GameConfig(Config):
    """Cosmic Ways — 5x3, 243-ways neon slot (official math-sdk path)."""

    def read_reels_csv(self, file_path):
        """Read a reelstrip CSV, dropping the shared `R1,R2,…` header row."""
        strips = super().read_reels_csv(file_path)
        cleaned = []
        for strip in strips:
            if strip and strip[0][:1].upper() == "R" and strip[0][1:].isdigit():
                strip = strip[1:]
            cleaned.append(strip)
        return cleaned

    def __init__(self) -> None:
        super().__init__()
        d = _load_shared_definition()
        eng = d["engine"]
        fs = d["features"]["freeSpins"]

        self.game_id = "cosmicways"
        self.provider_number = 0
        self.working_name = "CosmicWays"
        self.wincap = float(eng["wincapMultiplier"])
        self.win_type = "ways"
        self.rtp = float(eng["rtpTarget"])
        self.construct_paths()

        self.num_reels = int(eng["numReels"])
        self.num_rows = [int(eng["numRows"])] * self.num_reels
        self.paylines = {}  # ways games have no fixed paylines

        # Ways/cluster pay the paytable value directly (no per-line division).
        self.paytable = {}
        for sym, pays in d["paytable"].items():
            for count, value in pays.items():
                self.paytable[(int(count), sym)] = float(value)

        self.include_padding = True
        wild_id = next(s["id"] for s in d["symbols"] if s["kind"] == "wild")
        scatter_id = d["scatter"]["symbol"]
        self.special_symbols = {"wild": [wild_id], "scatter": [scatter_id], "multiplier": [wild_id]}

        awards = {int(k): int(v) for k, v in fs["awards"].items()}
        self.freespin_triggers = {self.basegame_type: awards}
        if fs.get("retrigger"):
            self.freespin_triggers[self.freegame_type] = awards
        self.anticipation_triggers = {
            self.basegame_type: min(awards) - 1,
            self.freegame_type: min(awards) - 1,
        }

        # WCAP is a wild-heavy free-game strip used only by the forced win-cap
        # distribution so the 5000x cap is reliably reachable.
        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv", "WCAP": "WCAP.csv"}
        self.reels = {}
        for name, fname in reels.items():
            self.reels[name] = self.read_reels_csv(os.path.join(self.reels_path, fname))
        self.padding_reels[self.basegame_type] = self.reels["BR0"]
        self.padding_reels[self.freegame_type] = self.reels["FR0"]

        mw = d["features"]["multiplierWilds"]
        free_mult = {int(v): int(w) for v, w in zip(mw["values"], mw["weights"])}
        base_mult = {1: 1}

        # Guard: multiplier wilds are disabled for this ways game (values == [1]).
        # The SDK applies wild multipliers per the "symbol" strategy, which differs
        # from the standalone engine's additive-sum reconciliation for ways wins
        # (ADR 0005). Until that reconciliation is implemented and parity-tested,
        # refuse to certify a ways game with realized (>1) multiplier wilds rather
        # than silently mis-paying. See docs/REMAINING-WORK.md §1.
        if any(int(v) > 1 for v in mw["values"]):
            raise ValueError(
                "cosmicways: multiplierWilds.values has a value > 1, but the ways "
                "wild-multiplier reconciliation (SDK 'symbol' strategy vs standalone "
                "additive sum) is not implemented. Implement + parity-test it before "
                "enabling realized multiplier wilds for a ways game (ADR 0005)."
            )

        # --- Convenience attributes used by the executables/override layers ---
        self.contract_win_event = "wayWins"
        self.wild_symbol = wild_id
        self.scatter_symbol = scatter_id
        self.scatter_paytable = {int(c): float(v) for c, v in d["scatter"]["pays"].items()}
        self.scatter_min = int(d["scatter"]["minToTrigger"])
        self.free_win_scale = float(fs.get("winScale", 1.0))
        ladder = fs["multiplierLadder"]
        self.ladder_start = int(ladder["start"])
        self.ladder_step = int(ladder["step"])
        self.ladder_max = int(ladder["max"])
        self.expanding_reels = ()  # expanding wilds disabled for this game

        def cond(force_freegame: bool, force_wincap: bool) -> dict:
            return {
                "reel_weights": {
                    self.basegame_type: {"BR0": 1},
                    self.freegame_type: {"FR0": 1},
                },
                "scatter_triggers": {k: 1 for k in awards},
                "mult_values": {self.basegame_type: base_mult, self.freegame_type: free_mult},
                "force_wincap": force_wincap,
                "force_freegame": force_freegame,
            }

        base_only = {
            "reel_weights": {self.basegame_type: {"BR0": 1}},
            "mult_values": {self.basegame_type: base_mult},
            "force_wincap": False,
            "force_freegame": False,
        }
        # Forced win-cap: a wild-heavy free reel so the high win-scale free game
        # reliably reaches the 5000x cap, giving the optimizer win-cap examples to
        # weight. Multiplier wilds stay disabled (mult_values == {1: 1}).
        wincap_condition = {
            "reel_weights": {
                self.basegame_type: {"BR0": 1},
                self.freegame_type: {"FR0": 1, "WCAP": 8},
            },
            "scatter_triggers": {k: 1 for k in awards},
            "mult_values": {self.basegame_type: base_mult, self.freegame_type: free_mult},
            "force_wincap": True,
            "force_freegame": True,
        }
        buy_cost = float(d["features"]["bonusBuy"]["costMultiplier"])

        self.bet_modes = [
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=self.wincap,
                        conditions=wincap_condition,
                    ),
                    Distribution(criteria="freegame", quota=0.1, conditions=cond(True, False)),
                    Distribution(criteria="0", quota=0.4, win_criteria=0.0, conditions=base_only),
                    Distribution(criteria="basegame", quota=0.5, conditions=base_only),
                ],
            ),
            BetMode(
                name="bonus",
                cost=buy_cost,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=False,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.005,
                        win_criteria=self.wincap,
                        conditions=wincap_condition,
                    ),
                    Distribution(criteria="freegame", quota=0.995, conditions=cond(True, False)),
                ],
            ),
        ]
