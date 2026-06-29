"""NovaForged config for the official StakeEngine math-sdk (real API).

Ported from the SDK's own `0_0_lines` example to the **current** SDK `Config`
API (see ADR 0005 Update 2): numbers are loaded from the canonical
`shared/games/novaforged/game-definition.json` so the SDK stays in lock-step
with the standalone engine and the frontend.

Mechanic: 5x3 lines, free-game realized multiplier wilds (native SDK Symbol
`multiplier` attribute, summed per line), expanding wilds on the middle reels,
an escalating global-multiplier ladder, and a buy-bonus. The free-game win
scale + ladder mirror `math/simulator/engine.py` so the certified RTP matches.
"""

import json
import os

from src.config.config import Config  # type: ignore
from src.config.distributions import Distribution  # type: ignore
from src.config.betmode import BetMode  # type: ignore


def _load_shared_definition() -> dict:
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.normpath(os.path.join(here, "..", "..", "..", "shared", "games", "novaforged", "game-definition.json")),
        os.path.normpath(os.path.join(here, "..", "..", "shared", "games", "novaforged", "game-definition.json")),
        os.path.normpath(os.path.join(here, "..", "shared-games", "novaforged", "game-definition.json")),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("Could not locate shared game-definition.json for NovaForged")


class GameConfig(Config):
    """NovaForged — 5x3, 20-line neon-cosmic slot (official math-sdk path)."""

    def read_reels_csv(self, file_path):
        """Read a reelstrip CSV, dropping the shared `R1,R2,…` header row.

        The shared reel files carry a column header the SDK's reader would
        otherwise ingest as symbols (`R4 is not registered`); strip it so the
        same files serve both the standalone engine and the SDK.
        """
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

        self.game_id = "novaforged"
        self.provider_number = 0
        self.working_name = "NovaForged"
        self.wincap = float(eng["wincapMultiplier"])
        self.win_type = "lines"
        self.rtp = float(eng["rtpTarget"])
        self.construct_paths()

        # Board dimensions.
        self.num_reels = int(eng["numReels"])
        self.num_rows = [int(eng["numRows"])] * self.num_reels

        # Paylines: SDK expects {line_id: [row per reel]} (1-indexed ids).
        self.paylines = {i + 1: list(line) for i, line in enumerate(d["paylines"])}
        num_paylines = len(self.paylines)

        # Paytable: SDK expects {(count, symbol): payout}. The shared paytable is
        # expressed in TOTAL-bet units (the standalone divides each line win by
        # num_paylines — see mechanics.py); the SDK pays per line and sums, so we
        # divide here to land on the same per-line payout. Wild pays; the scatter
        # is a special pay/trigger, handled separately (not a line symbol).
        self.paytable = {}
        for sym, pays in d["paytable"].items():
            for count, value in pays.items():
                self.paytable[(int(count), sym)] = float(value) / num_paylines

        self.include_padding = True
        wild_id = next(s["id"] for s in d["symbols"] if s["kind"] == "wild")
        scatter_id = d["scatter"]["symbol"]
        self.special_symbols = {"wild": [wild_id], "scatter": [scatter_id], "multiplier": [wild_id]}

        # Free-spin awards: {num_scatter: num_spins}; retrigger reuses the table.
        awards = {int(k): int(v) for k, v in fs["awards"].items()}
        self.freespin_triggers = {self.basegame_type: awards}
        if fs.get("retrigger"):
            self.freespin_triggers[self.freegame_type] = awards
        self.anticipation_triggers = {
            self.basegame_type: min(awards) - 1,
            self.freegame_type: min(awards) - 1,
        }

        # Reels. WCAP is a wild-heavy free-game strip used only by the forced
        # win-cap distribution (mirrors the SDK's FRWCAP reel) so 5000x is
        # reliably reachable.
        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv", "WCAP": "WCAP.csv"}
        self.reels = {}
        for name, fname in reels.items():
            self.reels[name] = self.read_reels_csv(os.path.join(self.reels_path, fname))
        self.padding_reels[self.basegame_type] = self.reels["BR0"]
        self.padding_reels[self.freegame_type] = self.reels["FR0"]

        # Realized free-game multiplier wilds: value@weight from the definition.
        mw = d["features"]["multiplierWilds"]
        free_mult = {int(v): int(w) for v, w in zip(mw["values"], mw["weights"])}
        base_mult = {1: 1}

        # --- Convenience attributes used by the executables/override layers ---
        self.contract_win_event = "lineWins"
        self.wild_symbol = wild_id
        self.scatter_symbol = scatter_id
        self.scatter_paytable = {int(c): float(v) for c, v in d["scatter"]["pays"].items()}
        self.scatter_min = int(d["scatter"]["minToTrigger"])
        self.free_win_scale = float(fs.get("winScale", 1.0))
        ladder = fs["multiplierLadder"]
        self.ladder_start = int(ladder["start"])
        self.ladder_step = int(ladder["step"])
        self.ladder_max = int(ladder["max"])
        self.expanding_reels = (1, 2, 3)  # middle three reels (0-indexed)

        # Distribution conditions (mirror 0_0_lines): which reels, the free-game
        # multiplier distribution, and force flags per criteria.
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

        # Forced win-cap: a wild-heavy free reel plus inflated realized
        # multipliers so the free game reliably reaches the 5000x cap, giving the
        # optimizer win-cap examples to weight (mirrors 0_0_lines' wincap path).
        wincap_condition = {
            "reel_weights": {
                self.basegame_type: {"BR0": 1},
                self.freegame_type: {"FR0": 1, "WCAP": 8},
            },
            "scatter_triggers": {k: 1 for k in awards},
            "mult_values": {
                self.basegame_type: base_mult,
                self.freegame_type: {5: 20, 10: 40, 20: 30, 50: 10},
            },
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
