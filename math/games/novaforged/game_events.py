"""Book-event factories for NovaForged.

Each function returns a JSON-serialisable dict appended to the simulation book.
The event ``type`` vocabulary is the contract consumed by the frontend
(see ``frontend/src/core/bookEvents.ts`` and ``docs/architecture.md``). Keeping
these in one place guarantees the math and the client never drift.
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


def win_info_event(state, win, payout):
    return {
        "type": "lineWin",
        "line": win["line"],
        "symbol": win["symbol"],
        "count": win["count"],
        "wildMultiplier": win["wild_mult"],
        "amount": round(payout, 6),
    }


def scatter_event(state, count, amount):
    return {"type": "scatterWin", "count": count, "amount": round(amount, 6)}


def freespin_trigger_event(state, scatters, awarded, retrigger=False):
    return {
        "type": "freeSpinRetrigger" if retrigger else "freeSpinTrigger",
        "scatters": scatters,
        "awarded": awarded,
        "spinsTotal": state.tot_fs,
        "startMultiplier": state.global_multiplier,
    }


def freespin_update_event(state):
    return {"type": "freeSpinUpdate", "spin": state.fs, "spinsTotal": state.tot_fs, "globalMultiplier": state.global_multiplier}


def ladder_step_event(state):
    return {"type": "ladderStep", "globalMultiplier": state.global_multiplier}


def final_win_event(state, amount, wincap=False):
    return {"type": "finalWin", "amount": round(amount, 6), "wincap": wincap}
