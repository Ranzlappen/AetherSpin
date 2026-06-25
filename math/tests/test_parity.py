"""Cross-language parity: the committed golden-book corpus, summed by its event
vocabulary, must reconcile to each book's declared payout.

The same corpus is replayed and summed by the frontend
(``frontend/src/core/parity.test.ts``) with its own TypeScript ``BookEvent``
types. Both sides asserting ``min(sum of win events, wincap) == payoutMultiplier``
means a drift between what the math emits and what the client understands is a
test failure, not a silent production mis-render. Regenerate the corpus with
``PYTHONHASHSEED=0 python3 math/scripts/gen_golden_corpus.py`` (CI gates drift).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "math" / "simulator"))
sys.path.insert(0, str(ROOT / "math"))

from simulator.bookcontract import validate_book  # noqa: E402
from simulator.definition import load_definition  # noqa: E402

CORPUS_DIR = ROOT / "shared" / "fixtures" / "books"
# Events whose ``amount`` contributes to the round payout.
WIN_EVENT_TYPES = {"lineWins", "wayWins", "scatterWin", "freeSpinResult"}
TOL = 1e-4  # accumulated 6-dp rounding across many free spins; real drift is large


def _load(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _corpus_files() -> list[Path]:
    files = sorted(CORPUS_DIR.glob("*.jsonl"))
    assert files, f"no corpus under {CORPUS_DIR}; run gen_golden_corpus.py"
    return files


def _win_sum(book: dict) -> float:
    return sum(e["amount"] for e in book["events"] if e["type"] in WIN_EVENT_TYPES)


def _final(book: dict) -> dict:
    finals = [e for e in book["events"] if e["type"] == "finalWin"]
    assert len(finals) == 1, f"book {book['id']} must have exactly one finalWin"
    return finals[0]


@pytest.mark.parametrize("path", _corpus_files(), ids=lambda p: p.stem)
def test_corpus_books_are_valid_and_reconcile(path: Path) -> None:
    game = path.stem.rsplit("_", 1)[0]
    wincap = load_definition(game).wincap
    books = _load(path)
    assert books, f"{path.name} is empty"
    for book in books:
        problems = validate_book(book, wincap=wincap)
        assert not problems, f"{path.name} id={book['id']}: {problems}"

        final = _final(book)
        # The declared payout is the final event amount …
        assert abs(final["amount"] - book["payoutMultiplier"]) < 1e-9, f"{path.name} id={book['id']}"
        # … and equals the win-event sum, clamped to the win cap.
        expected = min(_win_sum(book), wincap)
        assert abs(final["amount"] - expected) < TOL, (
            f"{path.name} id={book['id']}: finalWin {final['amount']} != "
            f"min(win-sum {_win_sum(book):.6f}, cap {wincap})"
        )


def test_corpus_covers_both_mechanics_and_the_feature() -> None:
    """Guard that the corpus actually exercises lines, ways, and free spins —
    otherwise parity would pass vacuously."""
    seen_types: set[str] = set()
    for path in _corpus_files():
        for book in _load(path):
            seen_types.update(e["type"] for e in book["events"])
    assert "lineWins" in seen_types, "corpus missing a lines win"
    assert "wayWins" in seen_types, "corpus missing a ways win"
    assert "freeSpinResult" in seen_types, "corpus missing the free-spin feature"
