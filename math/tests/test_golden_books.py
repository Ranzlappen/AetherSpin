"""Golden-master guard for the generated book library.

Two protections against silent math drift:

1. ``test_books_are_deterministic`` — regenerating from the same seed yields
   byte-identical books. Environment-independent; the core reproducibility claim.
2. ``test_books_match_golden_hashes`` — the books' SHA-256 match a committed
   fixture, so ANY change to the engine, definition, or reels that alters
   outcomes is caught in review. Requires ``PYTHONHASHSEED=0`` (set in CI); when
   a math change is intentional, regenerate the fixture:

       PYTHONHASHSEED=0 python3 math/tests/test_golden_books.py --update

Only the ``books_*.jsonl`` are hashed — ``config.json`` carries a timestamp and
git commit that legitimately vary run to run.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import pytest

MATH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MATH_ROOT / "simulator"))
sys.path.insert(0, str(MATH_ROOT))

from simulator.runner import run_simulations, write_library  # noqa: E402

GAME = "novaforged"
SEED = 20260624
NUM_BY_MODE = {"base": 2000, "bonus": 400}
MODES = ("base", "bonus")
GOLDEN_FILE = Path(__file__).parent / "golden" / "novaforged_books.sha256.json"

_HASHSEED_PINNED = os.environ.get("PYTHONHASHSEED") == "0"


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _generate(into: Path) -> dict[str, str]:
    """Generate a small library into ``into`` and return {file: sha256}."""
    out = run_simulations(GAME, NUM_BY_MODE, seed=SEED)
    game_dir = write_library(GAME, out, into, seed=SEED)
    return {
        f"books_{mode}.jsonl": _sha256(game_dir / "books" / f"books_{mode}.jsonl")
        for mode in MODES
    }


def test_books_are_deterministic(tmp_path: Path) -> None:
    """Same seed → byte-identical books across two independent generations."""
    first = _generate(tmp_path / "a")
    second = _generate(tmp_path / "b")
    assert first == second, "library generation is not byte-reproducible for a fixed seed"


@pytest.mark.skipif(
    not _HASHSEED_PINNED,
    reason="golden hashes require PYTHONHASHSEED=0 (set in CI) for determinism",
)
def test_books_match_golden_hashes(tmp_path: Path) -> None:
    """Generated books match the committed golden hashes (catches math drift)."""
    assert GOLDEN_FILE.is_file(), (
        f"missing golden fixture {GOLDEN_FILE}; create it with "
        f"`PYTHONHASHSEED=0 python3 {Path(__file__).name} --update`"
    )
    golden = json.loads(GOLDEN_FILE.read_text(encoding="utf-8"))
    actual = _generate(tmp_path)
    assert actual == golden["hashes"], (
        "book hashes changed — a math/definition/reel change altered outcomes.\n"
        "If intentional, regenerate the fixture:\n"
        "    PYTHONHASHSEED=0 python3 math/tests/test_golden_books.py --update"
    )


def _update_fixture() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        hashes = _generate(Path(td))
    GOLDEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "game": GAME,
        "seed": SEED,
        "numByMode": NUM_BY_MODE,
        "note": "Regenerate with PYTHONHASHSEED=0 python3 math/tests/test_golden_books.py --update",
        "hashes": hashes,
    }
    GOLDEN_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {GOLDEN_FILE}")
    for k, v in hashes.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    if "--update" in sys.argv:
        if not _HASHSEED_PINNED:
            raise SystemExit("Set PYTHONHASHSEED=0 before updating the golden fixture.")
        _update_fixture()
    else:
        print("Run via pytest, or pass --update to regenerate the golden fixture.")
