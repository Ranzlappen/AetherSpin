"""Reel-strip loading and weighted stop sampling."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .rng import Rng


@dataclass
class ReelSet:
    """A set of reel strips, one list of symbol stops per reel."""

    name: str
    strips: list[list[str]]

    @property
    def num_reels(self) -> int:
        return len(self.strips)

    def length(self, reel: int) -> int:
        return len(self.strips[reel])

    def window(self, reel: int, stop: int, rows: int) -> list[str]:
        """Return the visible symbols for ``reel`` given a top ``stop`` index.

        Wraps around the strip so any stop index is valid.
        """
        strip = self.strips[reel]
        n = len(strip)
        return [strip[(stop + r) % n] for r in range(rows)]

    def random_stop(self, reel: int, rng: Rng) -> int:
        return rng.randint(0, len(self.strips[reel]) - 1)


def load_reelset(name: str, csv_path: str | Path) -> ReelSet:
    """Load a reel set from a CSV file.

    The CSV has a header row of reel names (``R1,R2,...``) followed by one row
    per strip position; empty cells are ignored so reels may differ in length.
    """
    strips: list[list[str]] = []
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        strips = [[] for _ in header]
        for row in reader:
            for i, cell in enumerate(row):
                cell = cell.strip()
                if cell:
                    strips[i].append(cell)
    return ReelSet(name=name, strips=strips)
