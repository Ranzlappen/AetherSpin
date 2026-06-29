#!/usr/bin/env python3
"""Validate SDK-generated NovaForged books against the shared `BookEvent` contract.

The official math-sdk produces the *certified* books; this checks that those
books speak the exact event vocabulary the frontend replays
(`shared/src/types/events.ts`) — the same one the standalone engine emits — so a
real SDK book can be replayed without any translation layer.

The per-event required-field map lives in `simulator/bookcontract.py` (shared
with the standalone book validator and the event-contract tests); this script
adds the SDK-specific structural checks: event ordering, free-game
trigger/end pairing, and the SDK's cents-encoded `payoutMultiplier`
(`int(round(finalWin.amount * 100))`, vs the standalone's float multiplier).

Stdlib only. Usage:

    python math/scripts/validate_sdk_books.py path/to/books_base.json [more.json ...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "simulator"))

from bookcontract import validate_event  # noqa: E402  (shared required-field map)

GAME_TYPES = {"base", "free"}


def validate_book(book: dict, idx: int) -> list[str]:
    """Return a list of contract violations for a single SDK book (empty == valid)."""
    errors: list[str] = []
    bid = book.get("id", f"#{idx}")

    events = book.get("events")
    if not isinstance(events, list) or not events:
        return [f"book {bid}: missing/empty events"]

    types = [e.get("type") for e in events]
    if types[0] != "reveal":
        errors.append(f"book {bid}: first event is {types[0]!r}, expected 'reveal'")
    if types[-1] != "finalWin":
        errors.append(f"book {bid}: last event is {types[-1]!r}, expected 'finalWin'")
    if types.count("finalWin") != 1:
        errors.append(f"book {bid}: expected exactly one finalWin, got {types.count('finalWin')}")

    in_free = False
    for e in events:
        # Per-event field validation comes from the shared contract definition.
        for problem in validate_event(e):
            errors.append(f"book {bid}: {problem}")

        et = e.get("type")
        if et in ("reveal", "lineWins", "wayWins", "clusterWins") and e.get("gameType") not in GAME_TYPES:
            errors.append(f"book {bid}: {et} gameType {e.get('gameType')!r} not in {GAME_TYPES}")
        if et == "freeSpinTrigger":
            in_free = True
        elif et == "freeSpinResult" and not in_free:
            errors.append(f"book {bid}: freeSpinResult before any freeSpinTrigger")
        elif et == "freeSpinEnd":
            in_free = False
        elif et == "reveal" and not all(isinstance(col, list) and col for col in e.get("board", [])):
            errors.append(f"book {bid}: reveal board is not a non-empty list of columns")

    if types.count("freeSpinTrigger") != types.count("freeSpinEnd"):
        errors.append(
            f"book {bid}: freeSpinTrigger/freeSpinEnd mismatch "
            f"({types.count('freeSpinTrigger')}/{types.count('freeSpinEnd')})"
        )

    # The SDK encodes payoutMultiplier as cents = int(round(mult * 100)).
    final = next((e for e in reversed(events) if e.get("type") == "finalWin"), None)
    if final is not None and "payoutMultiplier" in book:
        expect = int(round(float(final["amount"]) * 100))
        if int(book["payoutMultiplier"]) != expect:
            errors.append(
                f"book {bid}: payoutMultiplier {book['payoutMultiplier']} != finalWin amount*100 ({expect})"
            )

    # Stake RGS rule (utils/rgs_verification.verify_lookup_format): the payout
    # must be a non-negative integer, divisible by 10, and >= 10 when non-zero.
    if "payoutMultiplier" in book:
        pm = book["payoutMultiplier"]
        if int(pm) != pm or pm < 0:
            errors.append(f"book {bid}: payoutMultiplier {pm} is not a non-negative integer")
        elif pm % 10 != 0:
            errors.append(f"book {bid}: payoutMultiplier {pm} is not divisible by 10 (0.1x increments)")
        elif 0 < pm < 10:
            errors.append(f"book {bid}: payoutMultiplier {pm} below the minimum non-zero payout (10)")
    return errors


def validate_file(path: str) -> tuple[int, list[str]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):  # tolerate {id: book} maps
        data = list(data.values())
    errors: list[str] = []
    for idx, book in enumerate(data):
        errors.extend(validate_book(book, idx))
    return len(data), errors


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    total = 0
    for path in argv:
        n, errors = validate_file(path)
        if errors:
            print(f"FAIL {path}: {len(errors)} violation(s) over {n} books")
            for e in errors[:25]:
                print("  -", e)
            if len(errors) > 25:
                print(f"  … and {len(errors) - 25} more")
            total += len(errors)
        else:
            print(f"OK   {path}: {n} books conform to the BookEvent contract")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
