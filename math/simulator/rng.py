"""Deterministic, seedable RNG wrapper.

Wrapping :mod:`random` keeps the engine reproducible (every simulation index
maps to a fixed seed) and gives us a single choke point should we later swap in
a certified RNG source.
"""

from __future__ import annotations

import random


class Rng:
    def __init__(self, seed: int | None = None) -> None:
        self._random = random.Random(seed)

    def reseed(self, seed: int) -> None:
        self._random.seed(seed)

    def randint(self, low: int, high: int) -> int:
        """Inclusive on both ends."""
        return self._random.randint(low, high)

    def random(self) -> float:
        return self._random.random()

    def weighted_choice(self, items: list, weights: list[int]) -> object:
        return self._random.choices(items, weights=weights, k=1)[0]
