#!/usr/bin/env python3
"""Generate the committed golden-book parity corpus.

A small, fixed-seed set of real engine-produced books per game/mode, written to
``shared/fixtures/books/<game>_<mode>.jsonl``. The corpus is replayed by BOTH
sides — Python (``math/tests/test_parity.py``) and the frontend
(``frontend/src/core/parity.test.ts``) — and each asserts the same event-sum
invariant, so any drift between what the math emits and what the client
understands becomes a test failure rather than a production mis-render.

Deterministic: run with ``PYTHONHASHSEED=0``. CI regenerates and fails on any
diff (the corpus must stay in lock-step with the engine).

    PYTHONHASHSEED=0 python3 math/scripts/gen_golden_corpus.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "math" / "simulator"))
sys.path.insert(0, str(ROOT / "math"))

from simulator.runner import run_simulations  # noqa: E402

OUT_DIR = ROOT / "shared" / "fixtures" / "books"
GAMES = ("novaforged", "cosmicways", "stellarclusters")
# Small but feature-covering: base draws naturally trigger some free games; the
# bonus mode forces the free-spin feature on every book.
NUM_BY_MODE = {"base": 60, "bonus": 20}
SEED = 73_42  # fixed, distinct from the golden-hash test's seed


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for game in GAMES:
        out = run_simulations(game, NUM_BY_MODE, seed=SEED)
        for mode, books in out.books.items():
            path = OUT_DIR / f"{game}_{mode}.jsonl"
            with path.open("w", encoding="utf-8") as fh:
                for book in books:
                    fh.write(json.dumps(book, separators=(",", ":"), sort_keys=True))
                    fh.write("\n")
            print(f"wrote {path.relative_to(ROOT)}  ({len(books)} books, {path.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
