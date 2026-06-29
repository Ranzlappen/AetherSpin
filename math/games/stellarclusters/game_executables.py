"""Reusable executable steps for Stellar Clusters (real math-sdk API).

The win mechanic is cluster-pays: `Cluster.get_cluster_data` finds
orthogonally-connected groups of a symbol (wilds substitute) of size >= the
paytable minimum and pays by size. Single evaluation (no tumble), matching the
standalone `ClusterMechanic`. Scatter is a special pay/trigger, and in the free
game the whole spin win (cluster + scatter) is scaled by the ladder multiplier
(flat here) and the free-game win scale.
"""

from game_calculations import GameCalculations
from src.calculations.cluster import Cluster  # type: ignore
from src.calculations.statistics import get_random_outcome  # type: ignore


class GameExecutables(GameCalculations):
    def evaluate_board_wins(self):
        """Evaluate cluster + scatter wins, apply free-game scaling, bank, and
        stash the contract-shaped results for event emission."""
        self.win_data = Cluster.get_cluster_data(self.config, self.board, global_multiplier=1)
        Cluster.record_cluster_wins(self)
        win_total = self.win_data["totalWin"]
        self.contract_wins = self._to_contract_wins(self.win_data["wins"])
        self.contract_win_total = win_total

        scatter_count = self.count_special_symbols("scatter")
        scatter_total = float(self.config.scatter_paytable.get(scatter_count, 0.0))
        self.contract_scatter = (
            {"count": scatter_count, "amount": round(scatter_total, 6)} if scatter_total > 0 else None
        )

        if self.gametype == self.config.freegame_type:
            spin_win = (win_total + scatter_total) * self.global_multiplier * self.config.free_win_scale
        else:
            spin_win = win_total + scatter_total

        self.win_manager.update_spinwin(round(spin_win, 6))
        self.evaluate_wincap()

    @staticmethod
    def _to_contract_wins(sdk_wins: list) -> list:
        """Translate SDK cluster-win dicts into the shared `ClusterWin` shape.
        `clusterMult` is the summed wild multiplier over the cluster (1 per wild
        cell when multiplier wilds are disabled)."""
        wins = []
        for win in sdk_wins:
            meta = win["meta"]
            wins.append(
                {
                    "symbol": win["symbol"],
                    "count": int(win["clusterSize"]),
                    "wildMultiplier": int(meta.get("clusterMult", 1)),
                    "amount": round(float(win["win"]), 6),
                    "cells": [{"reel": p["reel"], "row": p["row"]} for p in win["positions"]],
                }
            )
        return wins

    def expand_wilds(self) -> None:
        """Expanding wilds are disabled for this game."""
        self.expanding_wild_reels = []

    def evaluate_wincap(self) -> bool:
        """Flag the win-cap without the SDK's native event (folded into finalWin)."""
        if self.win_manager.running_bet_win >= self.config.wincap and not self.wincap_triggered:
            self.wincap_triggered = True
            return True
        return False

    def bump_ladder(self) -> bool:
        """Advance the ladder after a winning free spin (no-op when flat)."""
        if self.win_manager.spin_win > 0 and self.global_multiplier < self.config.ladder_max:
            self.global_multiplier = min(
                self.config.ladder_max, self.global_multiplier + self.config.ladder_step
            )
            return True
        return False
