"""Book-event factories for Stellar Clusters (official math-sdk path).

Stellar Clusters is a cluster-pays game, so wins are emitted as ``clusterWins``
(each carrying the connected ``cells`` it occupies and the group ``count``)
rather than ``lineWins``/``wayWins``. Every other event type is shared verbatim
with the lines/ways paths. The ``type`` vocabulary is the single contract
consumed by the frontend (``shared/src/types/events.ts`` / ``bookPlayer.ts``),
mirrored by the standalone engine
(``math/simulator/mechanics.py::ClusterMechanic``) and validated by
``math/simulator/bookcontract.py`` + ``shared/schemas/book.schema.json``.

These factories are pure (plain values, not SDK objects, except ``reveal_event``
which reads the board), so the contract can be unit-tested without the full SDK.
"""


def _board(state):
    return [[cell.name for cell in col] for col in state.board]


def _cluster_win_entry(w):
    return {
        "symbol": w["symbol"],
        "count": w["count"],
        "wildMultiplier": w.get("wild_mult", w.get("wildMultiplier", 1)),
        "amount": round(w["amount"], 6),
        "cells": [{"reel": int(c["reel"]), "row": int(c["row"])} for c in w["cells"]],
    }


def reveal_event(state, expanded_reels=None):
    """Reveal the (post-expansion) board, matching the standalone engine."""
    evt = {
        "type": "reveal",
        "gameType": "free" if state.in_freegame else "base",
        "board": _board(state),
        "reelStops": list(state.reel_positions),
    }
    if state.in_freegame:
        evt["globalMultiplier"] = state.global_multiplier
        evt["spin"] = state.fs
        evt["spinsTotal"] = state.tot_fs
        if expanded_reels:
            evt["expandedReels"] = list(expanded_reels)
    return evt


def cluster_wins_event(wins, amount, game_type):
    """Batched cluster wins for one board (the ``clusterWins`` contract event).

    ``wins`` is a list of ``{symbol, count, wildMultiplier, amount, cells}`` dicts
    where ``cells`` is a list of ``{reel, row}`` positions in the connected group.
    """
    return {
        "type": "clusterWins",
        "gameType": game_type,
        "wins": [_cluster_win_entry(w) for w in wins],
        "amount": round(amount, 6),
    }


def scatter_event(count, amount):
    return {"type": "scatterWin", "count": count, "amount": round(amount, 6)}


def freespin_trigger_event(scatters, awarded, start_multiplier):
    return {
        "type": "freeSpinTrigger",
        "scatters": scatters,
        "awarded": awarded,
        "startMultiplier": start_multiplier,
    }


def freespin_retrigger_event(scatters, awarded, spins_total):
    return {
        "type": "freeSpinRetrigger",
        "scatters": scatters,
        "awarded": awarded,
        "spinsTotal": spins_total,
    }


def freespin_result_event(spin, wins, scatter, global_multiplier, amount):
    """Per-free-spin result with cluster-shaped wins. ``scatter`` is ``{count, amount}`` or ``None``."""
    return {
        "type": "freeSpinResult",
        "spin": spin,
        "wins": [_cluster_win_entry(w) for w in wins],
        "scatter": scatter,
        "globalMultiplier": global_multiplier,
        "amount": round(amount, 6),
    }


def ladder_step_event(global_multiplier):
    return {"type": "ladderStep", "globalMultiplier": global_multiplier}


def freespin_end_event(total_win):
    return {"type": "freeSpinEnd", "totalWin": round(total_win, 6)}


def final_win_event(amount, wincap=False):
    return {"type": "finalWin", "amount": round(amount, 6), "wincap": wincap}
