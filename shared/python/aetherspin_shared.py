"""Cross-language shared constants and helpers (Python side).

The TypeScript equivalents live in ``shared/src``. Keep the constants here in
sync with ``shared/src/index.ts``.
"""

from __future__ import annotations

import json
from pathlib import Path

# Amount conversion constants (must match shared/src/index.ts).
API_AMOUNT_MULTIPLIER = 1_000_000  # dollars -> integer API amount
BOOK_AMOUNT_MULTIPLIER = 100       # multiplier -> integer book payout units

SHARED_DIR = Path(__file__).resolve().parents[1]
GAMES_DIR = SHARED_DIR / "games"


def to_api_amount(dollars: float) -> int:
    return round(dollars * API_AMOUNT_MULTIPLIER)


def from_api_amount(amount: int) -> float:
    return amount / API_AMOUNT_MULTIPLIER


def load_game_definition(game_id: str) -> dict:
    """Load a canonical game definition by id."""
    path = GAMES_DIR / game_id / "game-definition.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_game_ids() -> list[str]:
    return sorted(p.name for p in GAMES_DIR.iterdir() if p.is_dir())
