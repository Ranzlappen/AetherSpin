"""Tests for the version/definition-hash consistency guard
(`scripts/check-version-consistency.py`).

The guard recomputes a game's canonical `definitionHash` and compares it to the
hash stamped into the library/bundle. That only works if its hash computation is
byte-identical to the one the library writer uses — so the critical test is that
the two agree. A drift case proves the guard actually rejects a mismatch.
"""

import importlib.util
import sys
from pathlib import Path

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
