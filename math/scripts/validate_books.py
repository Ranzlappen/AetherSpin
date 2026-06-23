#!/usr/bin/env python3
"""Validate a generated RGS book library for integrity (stdlib only).

For each ``library/<game>/books/books_<mode>.jsonl`` it asserts:
  - ids are unique and contiguous from 1,
  - every ``payoutMultiplier`` <= the game's win cap,
  - every book starts with ``reveal`` and ends with ``finalWin``,
  - every event is a valid ``BookEvent`` with its required fields.

Exits non-zero on any violation so it can gate CI / packaging.

Usage:
    python3 math/scripts/validate_books.py --game novaforged
    python3 math/scripts/validate_books.py --game novaforged --library math/library
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT))

from simulator.bookcontract import validate_book  # noqa: E402
from simulator.definition import load_definition  # noqa: E402


def validate_mode_file(path: Path, wincap: float) -> tuple[int, list[str]]:
    problems: list[str] = []
    ids: list[int] = []
    count = 0
    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            count += 1
            try:
                book = json.loads(line)
            except json.JSONDecodeError as e:
                problems.append(f"{path.name}:{lineno}: invalid JSON ({e})")
                continue
            ids.append(book.get("id", -1))
            for p in validate_book(book, wincap=wincap):
                problems.append(f"{path.name} id={book.get('id')}: {p}")
    # id contiguity / uniqueness
    if ids:
        if len(set(ids)) != len(ids):
            problems.append(f"{path.name}: duplicate book ids")
        if sorted(ids) != list(range(1, len(ids) + 1)):
            problems.append(f"{path.name}: ids are not contiguous from 1..{len(ids)}")
    return count, problems


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate generated book library integrity")
    parser.add_argument("--game", default="novaforged")
    parser.add_argument("--library", default=str(ROOT / "library"))
    args = parser.parse_args()

    definition = load_definition(args.game)
    wincap = definition.wincap
    books_dir = Path(args.library) / args.game / "books"
    if not books_dir.is_dir():
        print(f"[FAIL] no books directory at {books_dir} — run generate_books.py first")
        return 1

    files = sorted(books_dir.glob("books_*.jsonl"))
    if not files:
        print(f"[FAIL] no books_*.jsonl found in {books_dir}")
        return 1

    all_problems: list[str] = []
    for path in files:
        count, problems = validate_mode_file(path, wincap)
        status = "PASS" if not problems else "FAIL"
        print(f"[{status}] {path.name}: {count:,} books validated (wincap {wincap:g}x)")
        all_problems.extend(problems)

    if all_problems:
        print(f"\n{len(all_problems)} problem(s):")
        for p in all_problems[:50]:
            print(f"  - {p}")
        if len(all_problems) > 50:
            print(f"  … and {len(all_problems) - 50} more")
        return 1
    print("\nAll books valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
