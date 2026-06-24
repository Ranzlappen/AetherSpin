"""Stdlib book/event contract checks (no third-party deps).

This is the runtime-enforceable mirror of ``shared/schemas/book.schema.json`` and
``shared/src/types/events.ts``. Keeping the required-field map here lets both the
book validator (``math/scripts/validate_books.py``) and the contract test
(``math/tests/test_event_contract.py``) share one definition, so the math and the
frontend cannot silently drift.
"""

from __future__ import annotations

from typing import Any

# event type -> required top-level keys (mirrors book.schema.json / events.ts)
EVENT_REQUIRED_FIELDS: dict[str, set[str]] = {
    "reveal": {"type", "gameType", "board", "reelStops"},
    "lineWins": {"type", "gameType", "wins", "amount"},
    "wayWins": {"type", "gameType", "wins", "amount"},
    "scatterWin": {"type", "count", "amount"},
    "freeSpinTrigger": {"type", "scatters", "awarded", "startMultiplier"},
    "freeSpinResult": {"type", "spin", "wins", "scatter", "globalMultiplier", "amount"},
    "ladderStep": {"type", "globalMultiplier"},
    "freeSpinRetrigger": {"type", "scatters", "awarded", "spinsTotal"},
    "freeSpinEnd": {"type", "totalWin"},
    "finalWin": {"type", "amount", "wincap"},
}

VALID_EVENT_TYPES = set(EVENT_REQUIRED_FIELDS)

# Events that carry a ``wins`` list. Each entry must have these common fields;
# the mechanic adds its own discriminator (``line`` for lines, ``ways`` for ways).
WIN_EVENTS = ("lineWins", "wayWins", "freeSpinResult")
WIN_ENTRY_FIELDS = {"symbol", "count", "wildMultiplier", "amount"}


def validate_event(event: dict[str, Any]) -> list[str]:
    """Return a list of human-readable problems for one event (empty == valid)."""
    problems: list[str] = []
    etype = event.get("type")
    if etype not in VALID_EVENT_TYPES:
        return [f"unknown event type {etype!r} (not in {sorted(VALID_EVENT_TYPES)})"]
    missing = EVENT_REQUIRED_FIELDS[etype] - set(event)
    if missing:
        problems.append(f"{etype}: missing required field(s) {sorted(missing)}")
    if etype in WIN_EVENTS:
        for w in event.get("wins", []):
            wmissing = WIN_ENTRY_FIELDS - set(w)
            if wmissing:
                problems.append(f"{etype}.wins entry missing {sorted(wmissing)}")
    return problems


def validate_book(book: dict[str, Any], wincap: float | None = None) -> list[str]:
    """Return a list of problems for one book (empty == valid)."""
    problems: list[str] = []
    for key in ("id", "payoutMultiplier", "events"):
        if key not in book:
            problems.append(f"book missing required key {key!r}")
    events = book.get("events", [])
    if not events:
        problems.append("book has no events")
        return problems
    if events[0].get("type") != "reveal":
        problems.append(f"first event must be 'reveal', got {events[0].get('type')!r}")
    if events[-1].get("type") != "finalWin":
        problems.append(f"last event must be 'finalWin', got {events[-1].get('type')!r}")
    for ev in events:
        problems.extend(validate_event(ev))
    if wincap is not None and isinstance(book.get("payoutMultiplier"), (int, float)):
        if book["payoutMultiplier"] > wincap + 1e-6:
            problems.append(f"payoutMultiplier {book['payoutMultiplier']} exceeds wincap {wincap}")
    return problems
