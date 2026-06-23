"""Book-event factories for NovaForged (official math-sdk path).

Each function returns a JSON-serialisable dict appended to the simulation book.
The event ``type`` vocabulary is the single contract consumed by the frontend
(``shared/src/types/events.ts`` / ``frontend/src/core/bookPlayer.ts``) and is
mirrored by the standalone engine (``math/simulator/engine.py``) and validated by
``math/simulator/bookcontract.py`` + ``shared/schemas/book.schema.json``.

These factories are intentionally pure (they take plain values, not SDK objects,
except ``reveal_event`` which reads the board) so the contract can be unit-tested
without the full SDK present.
"""


def _board(state):
    return [[cell.name for cell in col] for col in state.board]


def reveal_event(state):
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
    return evt


def line_wins_event(wins, amount, game_type):
    """Batched line wins for one board (matches the ``lineWins`` contract event).

    ``wins`` is a list of ``{line, symbol, count, wildMultiplier, amount}`` dicts.
    """
    return {
        "type": "lineWins",
        "gameType": game_type,
        "wins": [
            {
                "line": w["line"],
                "symbol": w["symbol"],
                "count": w["count"],
                "wildMultiplier": w.get("wild_mult", w.get("wildMultiplier", 1)),
                "amount": round(w["amount"], 6),
            }
            for w in wins
        ],
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
    """Per-free-spin result. ``scatter`` is ``{count, amount}`` or ``None``."""
    return {
        "type": "freeSpinResult",
        "spin": spin,
        "wins": [
            {
                "line": w["line"],
                "symbol": w["symbol"],
                "count": w["count"],
                "wildMultiplier": w.get("wild_mult", w.get("wildMultiplier", 1)),
                "amount": round(w["amount"], 6),
            }
            for w in wins
        ],
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
