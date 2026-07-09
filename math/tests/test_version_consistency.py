"""Tests for the version/definition-hash consistency guard
(`scripts/check-version-consistency.py`).

The guard recomputes a game's canonical `definitionHash` and compares it to the
hash stamped into the library/bundle. That only works if its hash computation is
byte-identical to the one the library writer uses — so the critical test is that
the two agree. A drift case proves the guard actually rejects a mismatch.

Also guards cross-artifact classification drift: the definition's
`engine.volatility` label must match the certified white paper's
"volatility (base)" class (derived from the optimizer lookup-table moments by
`math/scripts/generate_white_paper.py`), so submission artifacts never disagree.
"""

import importlib.util
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "math" / "simulator"))
sys.path.insert(0, str(ROOT / "math"))

from simulator.definition import load_definition  # noqa: E402
from simulator.runner import build_provenance  # noqa: E402


def _load_guard():
    path = ROOT / "scripts" / "check-version-consistency.py"
    spec = importlib.util.spec_from_file_location("check_version_consistency", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


GUARD = _load_guard()


def test_hash_agrees_with_library_writer():
    """The guard's definitionHash must match what build_provenance() stamps —
    otherwise the guard would false-positive on every freshly generated library."""
    d = load_definition("novaforged")
    guard_hash = GUARD.canonical_definition_hash(d.raw)
    writer_hash = build_provenance("novaforged", d, seed=42)["definitionHash"]
    assert guard_hash == writer_hash


def test_hash_is_stable_and_order_independent():
    """Canonicalisation sorts keys, so re-ordering the definition dict can't
    change the hash (the library is regenerated, not reformatted)."""
    d = load_definition("novaforged")
    raw = d.raw
    reordered = {k: raw[k] for k in reversed(list(raw))}
    assert GUARD.canonical_definition_hash(raw) == GUARD.canonical_definition_hash(reordered)


def test_drift_changes_the_hash():
    """Any real change to the definition must change the hash (so a stale library
    is detectable)."""
    d = load_definition("novaforged")
    drifted = dict(d.raw)
    drifted["version"] = str(drifted.get("version", "1.0.0")) + "-drift"
    assert GUARD.canonical_definition_hash(drifted) != GUARD.canonical_definition_hash(d.raw)


WHITE_PAPER_DIR = ROOT / "docs" / "white-papers"
_WP_VOLATILITY_RE = re.compile(r"\*\*volatility \(base\)\*\*\s+(.+?)\s*$", re.MULTILINE)


def _games_with_white_papers() -> list[str]:
    return sorted(p.name.removesuffix("-white-paper.md") for p in WHITE_PAPER_DIR.glob("*-white-paper.md"))


@pytest.mark.parametrize("game", _games_with_white_papers())
def test_definition_volatility_matches_white_paper(game: str):
    """The definition's `engine.volatility` enum must agree with the certified
    white paper's base-mode volatility class — reviewers see both."""
    wp_text = (WHITE_PAPER_DIR / f"{game}-white-paper.md").read_text(encoding="utf-8")
    match = _WP_VOLATILITY_RE.search(wp_text)
    assert match, f"no 'volatility (base)' line found in {game} white paper"
    # White paper classes ("Low"/"Medium"/"High"/"Very high") map onto the
    # schema enum ("low"/"medium"/"high"/"very-high").
    wp_class = match.group(1).strip().lower().replace(" ", "-")
    definition = load_definition(game).raw["engine"]["volatility"]
    assert definition == wp_class, (
        f"{game}: definition says volatility '{definition}' but the certified "
        f"white paper classifies base mode as '{wp_class}' — reconcile them "
        f"(the white paper is derived from the optimizer lookup tables)"
    )
