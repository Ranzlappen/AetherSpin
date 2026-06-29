"""Entry point for generating NovaForged results in the official math-sdk.

Run from within a cloned math-sdk (see scripts/setup-math.sh):

    cd math/engine && python games/novaforged/run.py

For local iteration without the SDK, use the standalone engine instead:

    python math/scripts/generate_books.py --game novaforged --sims 1000000
"""

import os

from gamestate import GameState
from game_config import GameConfig
from game_optimization import OptimizationSetup
from optimization_program.run_script import OptimizationExecution
from utils.game_analytics.run_analysis import create_stat_sheet
from utils.rgs_verification import execute_all_tests
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs

if __name__ == "__main__":
    num_threads = 10
    rust_threads = 20
    batching_size = 50000
    compression = True
    profiling = False

    # Production sim counts by default; override for a quick run via env
    # (e.g. SDK_BASE_SIMS=100000 SDK_BONUS_SIMS=40000).
    num_sim_args = {
        "base": int(os.environ.get("SDK_BASE_SIMS", int(1e6))),
        "bonus": int(os.environ.get("SDK_BONUS_SIMS", int(2e5))),
    }

    run_conditions = {
        "run_sims": True,
        "run_optimization": True,
        "run_analysis": True,
        "upload_data": False,
    }
    target_modes = ["base", "bonus"]

    config = GameConfig()
    gamestate = GameState(config)

    # OptimizationSetup populates config.opt_params, which generate_configs writes
    # into math_config.json (the optimizer reads its bet_modes/fences/bias from
    # there) — so it must run BEFORE the first generate_configs.
    if run_conditions["run_optimization"] or run_conditions["run_analysis"]:
        OptimizationSetup(config)

    if run_conditions["run_sims"]:
        create_books(gamestate, config, num_sim_args, batching_size, num_threads, compression, profiling)

    generate_configs(gamestate)

    if run_conditions["run_optimization"]:
        OptimizationExecution().run_all_modes(config, target_modes, rust_threads)
        generate_configs(gamestate)

    if run_conditions["run_analysis"]:
        create_stat_sheet(gamestate, custom_keys=[{"symbol": "scatter"}])
        execute_all_tests(config)
