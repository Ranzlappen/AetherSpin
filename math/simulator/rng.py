"""Deterministic, seedable RNG wrapper.

Wrapping :mod:`random` keeps the engine reproducible (every simulation index
maps to a fixed seed) and gives us a single choke point should we later swap in
a certified RNG source.

PROVENANCE / SCOPE — read before assuming this drives money:
    This RNG exists ONLY to pre-generate the simulation **library** (books +
    lookup tables) offline, deterministically, for dev / CI / RTP analysis. It
    is NOT a production randomness source. In production the **certified Stake
    RGS** owns all randomness and outcome selection — it picks which pre-verified
    book to serve. Neither this module nor any client code decides outcomes at
    play time (see ``SECURITY.md`` and ``docs/rng-provenance.md``). Because it is
    deterministically seeded (``PYTHONHASHSEED=0`` + fixed per-mode offsets), the
    library is byte-reproducible from a commit + seed, which is exactly what an
    auditor needs — and exactly why it must never be used as live entropy.
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from typing import TypeVar

T = TypeVar("T")


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

    def weighted_choice(self, items: Sequence[T], weights: Sequence[int]) -> T:
        return self._random.choices(list(items), weights=list(weights), k=1)[0]
