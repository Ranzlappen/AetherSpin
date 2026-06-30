"""End-to-end contract test for the NovaForged official-SDK book output.

Unlike the pure event-factory contract tests (which validate the factories in
isolation with no SDK present), this one **runs the real `StakeEngine/math-sdk`**
pipeline (`create_books`) for a small sample and asserts every emitted book
conforms to the shared `BookEvent` contract — the runnable proof that the
certified SDK books replay on the same frontend as the standalone engine.

The SDK is vendored on demand into the gitignored `math/engine/` (see
`scripts/setup-math.sh`) and isn't present in stdlib-only CI, so this test
**skips cleanly** unless the SDK is importable. Where it is present, it is the
acceptance check for the book-contract half of `check-sdk-parity`.
"""

import importlib
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
GAME_DIR = ROOT / "games" / "novaforged"

sys.path.insert(0, str(ROOT / "simulator"))
sys.path.insert(0, str(ROOT / "scripts"))

# Skip the whole module unless the vendored SDK is importable.
if not (ENGINE / "src" / "state" / "run_sims.py").exists():
    pytest.skip("StakeEngine math-sdk not vendored (math/engine absent)", allow_module_level=True)

sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(GAME_DIR))

try:
    create_books = importlib.import_module("src.state.run_sims").create_books
    GameState = importlib.import_module("gamestate").GameState
    GameConfig = importlib.import_module("game_config").GameConfig
except Exception as exc:  # pragma: no cover - environment dependent
    pytest.skip(f"SDK import failed: {exc}", allow_module_level=True)

from validate_sdk_books import validate_book  # noqa: E402


@pytest.fixture(scope="module")
def sdk_books():
    """Generate a small base+bonus book set once and return the parsed books."""
    import json

    config = GameConfig()
    gamestate = GameState(config)
    create_books(
        gamestate,
        config,
        {"base": 400, "bonus": 200},
        batch_size=200,
        threads=1,
        compress=False,
        profiling=False,
    )
    books_dir = Path(config.library_path) / "books" if hasattr(config, "library_path") else None
    out = {}
    for mode in ("base", "bonus"):
        # find books_<mode>.json under the SDK library tree
        path = None
        for cand in (ENGINE / "games" / "novaforged" / "library").rglob(f"books_{mode}.json"):
            path = cand
            break
        assert path is not None, f"no books_{mode}.json was written"
        with open(path, "r", encoding="utf-8") as f:
            out[mode] = json.load(f)
    return out


def test_books_were_generated(sdk_books):
    assert len(sdk_books["base"]) >= 400
    assert len(sdk_books["bonus"]) >= 200


@pytest.mark.parametrize("mode", ["base", "bonus"])
def test_every_book_conforms_to_contract(sdk_books, mode):
    errors = []
    for idx, book in enumerate(sdk_books[mode]):
        errors.extend(validate_book(book, idx))
    assert not errors, f"{mode}: {len(errors)} contract violation(s):\n" + "\n".join(errors[:20])


@pytest.mark.parametrize("mode", ["base", "bonus"])
def test_payouts_quantized_to_tenths(sdk_books, mode):
    """Stake RGS requires lookup-table payouts divisible by 10 (0.1x increments)
    with a minimum non-zero payout of 10 — so every book payoutMultiplier must
    be a non-negative multiple of 10 that is 0 or >= 10."""
    bad = [
        b.get("id")
        for b in sdk_books[mode]
        if b["payoutMultiplier"] % 10 != 0 or 0 < b["payoutMultiplier"] < 10
    ]
    assert not bad, f"{mode}: {len(bad)} books violate the 0.1x payout rule, e.g. {bad[:10]}"


def test_free_game_mechanics_present(sdk_books):
    """The bonus mode must exercise the full free-game vocabulary."""
    types = {e["type"] for book in sdk_books["bonus"] for e in book["events"]}
    for required in ("freeSpinTrigger", "reveal", "freeSpinResult", "freeSpinEnd", "finalWin", "scatterWin"):
        assert required in types, f"bonus books never emitted {required}"

    # Realized multiplier wilds must surface on free reveals.
    saw_mult_wild = any(
        e["type"] == "reveal" and e.get("multiplierWilds")
        for book in sdk_books["bonus"]
        for e in book["events"]
    )
    assert saw_mult_wild, "no free reveal carried multiplierWilds"
