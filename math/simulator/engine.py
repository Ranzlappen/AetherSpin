"""NovaForged lines-game evaluation engine.

Produces, for a single simulated round, a ``payoutMultiplier`` (in units of the
total bet) and an ordered list of ``events`` that the frontend replays to drive
the visuals. The same event vocabulary is documented in
``docs/architecture.md`` and mirrored by the TypeScript ``bookEvents`` types.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .definition import GameDefinition
from .reels import ReelSet
from .rng import Rng

# Total-bet multiplier cap is applied as a final clamp on every round.
EXPANDING_REELS = (1, 2, 3)  # middle three reels (0-indexed) for expanding wilds


@dataclass
class SpinResult:
    payout_multiplier: float
    events: list[dict[str, Any]]
    triggered_freegame: bool
    hit_wincap: bool


class LinesEngine:
    def __init__(self, definition: GameDefinition, base_reels: ReelSet, free_reels: ReelSet) -> None:
        self.d = definition
        self.base_reels = base_reels
        self.free_reels = free_reels
        self.wild = definition.wild
        self.scatter = definition.scatter
        self.paytable = definition.paytable
        self.paylines = definition.paylines
        self.num_lines = definition.num_paylines
        self.free_win_scale = definition.free_win_scale

    # ---- board construction -------------------------------------------------
    def _draw_board(self, reels: ReelSet, rng: Rng) -> tuple[list[list[str]], list[int]]:
        """Return (board, stops). board[reel] is the visible column top->bottom."""
        rows = self.d.num_rows
        stops = [reels.random_stop(r, rng) for r in range(reels.num_reels)]
        board = [reels.window(r, stops[r], rows) for r in range(reels.num_reels)]
        return board, stops

    def _apply_expanding_wilds(self, board: list[list[str]]) -> list[int]:
        """In free spins, any of the middle reels containing a wild expands to
        a full wild reel. Returns the list of reels that expanded."""
        expanded: list[int] = []
        rows = self.d.num_rows
        for r in EXPANDING_REELS:
            if any(sym == self.wild for sym in board[r]):
                board[r] = [self.wild] * rows
                expanded.append(r)
        return expanded

    # ---- evaluation ---------------------------------------------------------
    def _evaluate_lines(
        self, board: list[list[str]], mult_grid: list[list[int]] | None = None
    ) -> tuple[float, list[dict[str, Any]]]:
        """Evaluate all paylines. ``mult_grid`` (free game only) carries the
        realized per-cell wild multiplier; ``None`` means no wild multipliers."""
        total = 0.0
        wins: list[dict[str, Any]] = []
        for line_idx, pattern in enumerate(self.paylines):
            positions = [(reel, pattern[reel]) for reel in range(self.d.num_reels)]
            symbols = [board[reel][row] for reel, row in positions]
            win = self._evaluate_single_line(symbols, positions, mult_grid)
            if win is None:
                continue
            sym, count, line_value, mult = win
            payout = (line_value / self.num_lines) * mult
            total += payout
            wins.append(
                {
                    "line": line_idx,
                    "symbol": sym,
                    "count": count,
                    "wildMultiplier": mult,
                    "amount": round(payout, 6),
                }
            )
        return total, wins

    def _evaluate_single_line(self, symbols, positions, mult_grid):
        """Left-aligned line win. Returns (symbol, count, base_value, wild_mult).

        In the free game the line's wild multiplier is the SUM of the realized
        multipliers of the wild cells participating in the winning run
        (additive multiplier wilds). Sum (rather than product) keeps volatility
        bounded and the RTP tractable while still using the real, player-visible
        per-cell values.
        """
        pay_symbol = None
        for s in symbols:
            if s == self.scatter:
                break
            if s != self.wild:
                pay_symbol = s
                break
        if pay_symbol is None:
            pay_symbol = self.wild

        count = 0
        wild_sum = 0
        has_wild = False
        for idx, s in enumerate(symbols):
            if s == pay_symbol or s == self.wild:
                count += 1
                if s == self.wild and mult_grid is not None:
                    reel, row = positions[idx]
                    wild_sum += mult_grid[reel][row]
                    has_wild = True
            else:
                break
        wild_mult = wild_sum if has_wild else 1

        pays = self.paytable.get(pay_symbol, {})
        if count in pays:
            return pay_symbol, count, pays[count], wild_mult
        # try shorter matches that still pay (e.g. 5 wilds but symbol only pays 3)
        for c in range(count, 2, -1):
            if c in pays:
                return pay_symbol, c, pays[c], wild_mult
        return None

    def _sample_multiplier_grid(self, board: list[list[str]], rng: Rng):
        """Sample a realized multiplier for every wild cell (free game).

        Returns (grid, events_payload) where grid[reel][row] is the realized
        multiplier (1 for non-wild cells) and events_payload is the list of
        ``{reel,row,value}`` for the reveal event.
        """
        vals, wts = self.d.mult_wild_values, self.d.mult_wild_weights
        grid = [[1] * self.d.num_rows for _ in range(self.d.num_reels)]
        payload: list[dict[str, int]] = []
        for reel in range(self.d.num_reels):
            for row in range(self.d.num_rows):
                if board[reel][row] == self.wild:
                    value = int(rng.weighted_choice(vals, wts))
                    grid[reel][row] = value
                    payload.append({"reel": reel, "row": row, "value": value})
        return grid, payload

    def _evaluate_scatter(self, board: list[list[str]]) -> tuple[float, int]:
        count = sum(1 for col in board for sym in col if sym == self.scatter)
        pays = self.d.scatter_pays
        amount = pays.get(count, 0.0)
        return amount, count

    # ---- round orchestration ------------------------------------------------
    def play_round(self, sim_id: int, rng: Rng, force_free: bool = False, disable_free: bool = False) -> SpinResult:
        events: list[dict[str, Any]] = []
        total = 0.0

        board, stops = self._draw_board(self.base_reels, rng)
        if force_free:
            board = self._force_scatters(board, self.d.scatter_min)
        events.append({"type": "reveal", "gameType": "base", "board": board, "reelStops": stops})

        # Base game has no multiplier wilds (free-game feature only).
        line_total, line_wins = self._evaluate_lines(board, mult_grid=None)
        if line_wins:
            events.append({"type": "lineWins", "gameType": "base", "wins": line_wins, "amount": round(line_total, 6)})
        scatter_total, scatter_count = self._evaluate_scatter(board)
        if scatter_total > 0:
            events.append({"type": "scatterWin", "count": scatter_count, "amount": scatter_total})
        base_win = line_total + scatter_total
        total += base_win

        triggered = scatter_count >= self.d.scatter_min
        if triggered and not disable_free:
            free_win = self._run_freegame(scatter_count, rng, events)
            total += free_win

        total, capped = self._apply_cap(total)
        events.append({"type": "finalWin", "amount": round(total, 6), "wincap": capped})
        return SpinResult(payout_multiplier=round(total, 6), events=events, triggered_freegame=triggered, hit_wincap=capped)

    def _run_freegame(self, scatter_count: int, rng: Rng, events: list[dict[str, Any]]) -> float:
        awards = self.d.freespin_awards
        spins = awards.get(scatter_count, awards[max(awards)])
        ladder = self.d.multiplier_ladder
        global_mult = ladder["start"]
        events.append({"type": "freeSpinTrigger", "scatters": scatter_count, "awarded": spins, "startMultiplier": global_mult})

        free_total = 0.0
        spins_done = 0
        spins_total = spins
        while spins_done < spins_total:
            spins_done += 1
            board, stops = self._draw_board(self.free_reels, rng)
            expanded = self._apply_expanding_wilds(board) if self.d.expanding_wilds else []
            # Sample realized per-cell multipliers for every wild on this board.
            mult_grid, mult_wilds = self._sample_multiplier_grid(board, rng)
            reveal = {
                "type": "reveal",
                "gameType": "free",
                "board": board,
                "reelStops": stops,
                "spin": spins_done,
                "spinsTotal": spins_total,
                "globalMultiplier": global_mult,
            }
            if expanded:
                reveal["expandedReels"] = expanded
            if mult_wilds:
                reveal["multiplierWilds"] = mult_wilds
            events.append(reveal)

            line_total, line_wins = self._evaluate_lines(board, mult_grid=mult_grid)
            scatter_total, scatter_count2 = self._evaluate_scatter(board)
            spin_win = (line_total + scatter_total) * global_mult * self.free_win_scale
            if line_wins or scatter_total > 0:
                events.append(
                    {
                        "type": "freeSpinResult",
                        "spin": spins_done,
                        "wins": line_wins,
                        "scatter": {"count": scatter_count2, "amount": scatter_total} if scatter_total else None,
                        "globalMultiplier": global_mult,
                        "amount": round(spin_win, 6),
                    }
                )
            free_total += spin_win

            # Escalating multiplier ladder: bump on any winning spin.
            if (line_total + scatter_total) > 0 and global_mult < ladder["max"]:
                global_mult = min(ladder["max"], global_mult + ladder["step"])
                events.append({"type": "ladderStep", "globalMultiplier": global_mult})

            # Retrigger: more scatters award additional spins.
            if scatter_count2 >= self.d.scatter_min:
                extra = awards.get(scatter_count2, awards[max(awards)])
                spins_total += extra
                events.append({"type": "freeSpinRetrigger", "scatters": scatter_count2, "awarded": extra, "spinsTotal": spins_total})

        events.append({"type": "freeSpinEnd", "totalWin": round(free_total, 6)})
        return free_total

    # ---- helpers ------------------------------------------------------------
    def _apply_cap(self, total: float) -> tuple[float, bool]:
        if total >= self.d.wincap:
            return self.d.wincap, True
        return total, False

    def _force_scatters(self, board: list[list[str]], n: int) -> list[list[str]]:
        """Force a free-game trigger for distribution/forcing files."""
        placed = 0
        for r in range(self.d.num_reels):
            if placed >= n:
                break
            board[r][0] = self.scatter
            placed += 1
        return board
