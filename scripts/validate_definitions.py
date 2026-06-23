#!/usr/bin/env python3
"""Validate every shared/games/*/game-definition.json (semantic, stdlib only).

Structural validation against the JSON Schema is done separately in CI (ajv);
this covers the cross-field semantic rules. Exits non-zero on any problem.

Usage:
    python3 scripts/validate_definitions.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "math" / "simulator"))
sys.path.insert(0, str(ROOT / "math"))

from simulator.definition import semantic_problems  # noqa: E402

GAMES_DIR = ROOT / "shared" / "games"


def main() -> int:
    failures = 0
    games = sorted(p for p in GAMES_DIR.iterdir() if p.is_dir())
    if not games:
        print(f"[FAIL] no games found under {GAMES_DIR}")
        return 1
    for game_dir in games:
        defn = game_dir / "game-definition.json"
        if not defn.exists():
            print(f"[FAIL] {game_dir.name}: missing game-definition.json")
            failures += 1
            continue
        raw = json.loads(defn.read_text(encoding="utf-8"))
        problems = semantic_problems(raw)
        if problems:
            failures += 1
            print(f"[FAIL] {game_dir.name}:")
            for p in problems:
                print(f"    - {p}")
        else:
            print(f"[PASS] {game_dir.name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
