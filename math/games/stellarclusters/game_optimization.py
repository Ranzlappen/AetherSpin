"""Optimization setup for Stellar Clusters.

The official math-sdk ships a Rust-powered optimizer that adjusts reel-strip
weights so the measured RTP converges precisely on target per bet mode. This
class declares the optimization conditions (target RTP, hit-rate constraints,
allowed reel sets) that the optimizer consumes.
"""

from optimization_program.optimization_config import (  # type: ignore
    ConstructScaling,
    ConstructConditions,
    OptimizationSetup as _OptimizationSetup,
)


class OptimizationSetup(_OptimizationSetup):
    def __init__(self, config):
        self.game_config = config
        self.opt_params = {
            "base": {
                "rtp": config.rtp,
                "av_win": None,
                "search_conditions": ConstructConditions(
                    rtp=config.rtp,
                    hr=120,  # approx free-spin trigger frequency
                    search={"symbol": config.special_symbols["scatter"][0]},
                ).return_dict(),
                "scaling": ConstructScaling(
                    [
                        {"criteria": "basegame", "scale_factor": 1.0, "win_range": (0.0, 50.0)},
                        {"criteria": "freegame", "scale_factor": 1.0, "win_range": (0.0, 5000.0)},
                    ]
                ).return_dict(),
            },
            "bonus": {
                "rtp": config.rtp,
                "av_win": None,
                "search_conditions": ConstructConditions(rtp=config.rtp).return_dict(),
                "scaling": ConstructScaling(
                    [{"criteria": "freegame", "scale_factor": 1.0, "win_range": (0.0, 5000.0)}]
                ).return_dict(),
            },
        }
