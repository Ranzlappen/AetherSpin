"""Writers for the RGS-compatible math library output.

Mirrors the StakeEngine math-sdk ``library/`` layout so the standalone engine
and the official SDK are interchangeable for dashboard upload:

    library/<game_id>/
      books/books_<mode>.jsonl                 one JSON book per line
      lookup_tables/lookUpTable_<mode>.csv     id,weight,payout(book units)
      lookup_tables/lookUpTableIdToCriteria_<mode>.csv  id,criteria
      configs/config.json                      RGS math config (modes, costs)
      index.json                               manifest of modes -> files
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Book payouts are stored as integers in "book units" = multiplier * 100.
BOOK_AMOUNT_MULTIPLIER = 100


class LibraryWriter:
    def __init__(self, root: Path, game_id: str) -> None:
        self.game_dir = Path(root) / game_id
        self.books_dir = self.game_dir / "books"
        self.lut_dir = self.game_dir / "lookup_tables"
        self.cfg_dir = self.game_dir / "configs"
        for d in (self.books_dir, self.lut_dir, self.cfg_dir):
            d.mkdir(parents=True, exist_ok=True)
        self.game_id = game_id
        self._modes: dict[str, dict[str, Any]] = {}

    def write_mode(self, mode: str, books: list[dict[str, Any]], weights: list[int], criteria: list[str]) -> None:
        # books_<mode>.jsonl
        books_path = self.books_dir / f"books_{mode}.jsonl"
        with open(books_path, "w", encoding="utf-8") as f:
            for book in books:
                f.write(json.dumps(book, separators=(",", ":")))
                f.write("\n")

        # lookUpTable_<mode>.csv : id, weight, payout(book units)
        lut_path = self.lut_dir / f"lookUpTable_{mode}.csv"
        with open(lut_path, "w", encoding="utf-8") as f:
            for book, w in zip(books, weights):
                payout_units = round(book["payoutMultiplier"] * BOOK_AMOUNT_MULTIPLIER)
                f.write(f"{book['id']},{w},{payout_units}\n")

        # lookUpTableIdToCriteria_<mode>.csv : id, criteria
        crit_path = self.lut_dir / f"lookUpTableIdToCriteria_{mode}.csv"
        with open(crit_path, "w", encoding="utf-8") as f:
            for book, c in zip(books, criteria):
                f.write(f"{book['id']},{c}\n")

        self._modes[mode] = {
            "books": f"books/books_{mode}.jsonl",
            "lookupTable": f"lookup_tables/lookUpTable_{mode}.csv",
            "criteria": f"lookup_tables/lookUpTableIdToCriteria_{mode}.csv",
            "count": len(books),
        }

    def write_config(
        self,
        definition_raw: dict[str, Any],
        rtp_by_mode: dict[str, float],
        provenance: dict[str, Any] | None = None,
    ) -> None:
        config = {
            "gameId": self.game_id,
            "version": definition_raw.get("version", "1.0.0"),
            "providerName": definition_raw.get("studio", "AetherSpin"),
            "wincap": definition_raw["engine"]["wincapMultiplier"],
            "rtpTarget": definition_raw["engine"]["rtpTarget"],
            "bookAmountMultiplier": BOOK_AMOUNT_MULTIPLIER,
            "betModes": [
                {
                    "name": m["name"],
                    "cost": m["cost"],
                    "isBuyBonus": m.get("isBuyBonus", False),
                    "measuredRtp": round(rtp_by_mode.get(m["name"], 0.0), 6),
                }
                for m in definition_raw["betModes"]
            ],
        }
        if provenance is not None:
            config["provenance"] = provenance
        with open(self.cfg_dir / "config.json", "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)

    def write_index(self) -> None:
        index = {
            "gameId": self.game_id,
            "modes": self._modes,
            "files": {
                "config": "configs/config.json",
            },
        }
        with open(self.game_dir / "index.json", "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2)
