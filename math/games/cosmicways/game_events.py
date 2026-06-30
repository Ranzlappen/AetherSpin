"""Book events for Cosmic Ways (real math-sdk API) — emitted in the shared
`BookEvent` contract (`shared/src/types/events.ts`).

Generic across mechanics: the base-game win event type is read from
`config.contract_win_event` (`wayWins` here). The certified SDK books are
replayable by the same frontend that replays the standalone engine's books.
"""


def _contract_gametype(gamestate, game_type: str) -> str:
    return "free" if game_type == gamestate.config.freegame_type else "base"


def _board_strings(gamestate) -> list:
    return [[sym.name for sym in reel] for reel in gamestate.board]


def _multiplier_wilds(gamestate) -> list:
    out = []
    for reel, col in enumerate(gamestate.board):
        for row, sym in enumerate(col):
            if sym.check_attribute("wild") and getattr(sym, "multiplier", 1) and sym.multiplier > 1:
                out.append({"reel": reel, "row": row, "value": int(sym.multiplier)})
    return out


def reveal_event(gamestate, game_type: str, spin: int = None, spins_total: int = None) -> None:
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
    mechanic's contract name (lineWins/wayWins/clusterWins)."""
    gamestate.book.add_event(
        {
            "type": gamestate.config.contract_win_event,
            "gameType": _contract_gametype(gamestate, game_type),
            "wins": gamestate.contract_wins,
            "amount": round(gamestate.contract_win_total, 6),
        }
    )


def scatter_win_event(gamestate) -> None:
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
    capped = gamestate.win_manager.running_bet_win >= gamestate.config.wincap
    gamestate.book.add_event(
        {"type": "finalWin", "amount": round(gamestate.final_win, 6), "wincap": bool(capped)}
    )
