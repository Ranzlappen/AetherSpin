"""Book events for NovaForged (real math-sdk API) — emitted in the shared
`BookEvent` contract (`shared/src/types/events.ts`), NOT the SDK's native
vocabulary.

The certified SDK books must be replayable by the same frontend that replays the
standalone engine's books, so this module emits the exact event shapes the
standalone (`math/simulator/engine.py`) produces: `reveal`, `lineWins`,
`scatterWin`, `freeSpinTrigger`, `freeSpinResult`, `ladderStep`,
`freeSpinRetrigger`, `freeSpinEnd`, `finalWin`. Events are plain dicts appended
via `book.add_event`; the SDK sets `payoutMultiplier` from the win manager
independently, so swapping the event vocabulary is safe.

Data the contract needs (per-cell realized multipliers, expanded reels, scatter
pays, the ladder, per-spin global multiplier) only exists at simulation time —
hence emission here rather than a post-hoc translation of SDK-native events.
"""


def _contract_gametype(gamestate, game_type: str) -> str:
    """Map the SDK's internal gametype ("basegame"/"freegame") to the shared
    contract's `GameType` ("base"/"free")."""
    return "free" if game_type == gamestate.config.freegame_type else "base"


def _board_strings(gamestate) -> list:
    """The visible board as symbol-id strings, board[reel][row] top->bottom."""
    return [[sym.name for sym in reel] for reel in gamestate.board]


def _multiplier_wilds(gamestate) -> list:
    """Realized per-cell wild multipliers on the current board (free game)."""
    out = []
    for reel, col in enumerate(gamestate.board):
        for row, sym in enumerate(col):
            if sym.check_attribute("wild") and getattr(sym, "multiplier", 1) and sym.multiplier > 1:
                out.append({"reel": reel, "row": row, "value": int(sym.multiplier)})
    return out


def reveal_event(gamestate, game_type: str, spin: int = None, spins_total: int = None) -> None:
    """Board reveal. Free-game reveals carry spin progress, the ladder
    multiplier, any expanded reels, and the realized wild multipliers."""
    event = {
        "type": "reveal",
        "gameType": _contract_gametype(gamestate, game_type),
        "board": _board_strings(gamestate),
        "reelStops": list(gamestate.reel_positions),
    }
    if game_type == gamestate.config.freegame_type:
        event["spin"] = spin
        event["spinsTotal"] = spins_total
        event["globalMultiplier"] = int(gamestate.global_multiplier)
        if gamestate.expanding_wild_reels:
            event["expandedReels"] = list(gamestate.expanding_wild_reels)
        mult_wilds = _multiplier_wilds(gamestate)
        if mult_wilds:
            event["multiplierWilds"] = mult_wilds
    gamestate.book.add_event(event)


def win_event(gamestate, game_type: str) -> None:
    """Batched mechanic wins for a board (base game). The event type is the
    mechanic's contract name (`config.contract_win_event` — lineWins here)."""
    gamestate.book.add_event(
        {
            "type": gamestate.config.contract_win_event,
            "gameType": _contract_gametype(gamestate, game_type),
            "wins": gamestate.contract_wins,
            "amount": round(gamestate.contract_win_total, 6),
        }
    )


def scatter_win_event(gamestate) -> None:
    """Scatter pay for a board (base game)."""
    gamestate.book.add_event(
        {
            "type": "scatterWin",
            "count": gamestate.contract_scatter["count"],
            "amount": round(gamestate.contract_scatter["amount"], 6),
        }
    )


def free_spin_trigger_event(gamestate, scatters: int, awarded: int, start_multiplier: int) -> None:
    gamestate.book.add_event(
        {
            "type": "freeSpinTrigger",
            "scatters": scatters,
            "awarded": awarded,
            "startMultiplier": int(start_multiplier),
        }
    )


def free_spin_result_event(gamestate, spin: int) -> None:
    """Per free-spin result: the (unscaled) line wins, scatter, the ladder
    multiplier in force, and the scaled spin payout."""
    gamestate.book.add_event(
        {
            "type": "freeSpinResult",
            "spin": spin,
            "wins": gamestate.contract_wins,
            "scatter": gamestate.contract_scatter,
            "globalMultiplier": int(gamestate.global_multiplier),
            "amount": round(gamestate.win_manager.spin_win, 6),
        }
    )


def ladder_step_event(gamestate) -> None:
    gamestate.book.add_event({"type": "ladderStep", "globalMultiplier": int(gamestate.global_multiplier)})


def free_spin_retrigger_event(gamestate, scatters: int, awarded: int, spins_total: int) -> None:
    gamestate.book.add_event(
        {
            "type": "freeSpinRetrigger",
            "scatters": scatters,
            "awarded": awarded,
            "spinsTotal": spins_total,
        }
    )


def free_spin_end_event(gamestate, total_win: float) -> None:
    gamestate.book.add_event({"type": "freeSpinEnd", "totalWin": round(total_win, 6)})


def final_win_event(gamestate) -> None:
    """Round payout + win-cap flag (last event in every book)."""
    capped = gamestate.win_manager.running_bet_win >= gamestate.config.wincap
    gamestate.book.add_event(
        {"type": "finalWin", "amount": round(gamestate.final_win, 6), "wincap": bool(capped)}
    )
