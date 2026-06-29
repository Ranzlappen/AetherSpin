#!/usr/bin/env python3
"""Assert a game's version is consistent across the definition, the math library
config, and (when packaged) the submission bundle — and that the shipped library
was actually generated from the *current* definition.

The Stake submission checklist requires the version to agree across
`game-definition.json`, `config.json`, and the bundle. A version string can match
by luck while the library is stale, so this also recomputes the canonical
`definitionHash` from the live definition and checks the library/manifest
provenance against it — catching a library regenerated from an older definition.

Stdlib only.

    python scripts/check-version-consistency.py <game> [--bundle dist-stake/<game>]

Without --bundle it checks the working math library
(`math/library/<game>/configs/config.json`). With --bundle it also checks the
packaged `math/configs/config.json` and `submission-manifest.json`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def canonical_definition_hash(definition: dict) -> str:
    """Mirror runner.py: sha256 of the sorted, separator-tight definition JSON."""
    canonical = json.dumps(definition, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def check(game: str, bundle: Path | None) -> list[str]:
    problems: list[str] = []
    defn_path = ROOT / "shared" / "games" / game / "game-definition.json"
    if not defn_path.exists():
        return [f"definition not found: {defn_path}"]
    definition = _load(defn_path)
    defn_version = str(definition.get("version", ""))
    defn_hash = canonical_definition_hash(definition)
    print(f"  definition: version={defn_version} definitionHash={defn_hash[:12]}…")

    # The config to check: the packaged one if a bundle is given, else the
    # working math library.
    config_candidates = []
    if bundle is not None:
        config_candidates += [bundle / "math" / "configs" / "config.json", bundle / "config.json"]
    config_candidates += [ROOT / "math" / "library" / game / "configs" / "config.json"]
    config_path = next((p for p in config_candidates if p.exists()), None)
    if config_path is None:
        problems.append(f"config.json not found (looked in {[str(p) for p in config_candidates]})")
        return problems

    cfg = _load(config_path)
    rel = config_path.relative_to(ROOT) if config_path.is_relative_to(ROOT) else config_path
    cfg_version = str(cfg.get("version", ""))
    cfg_hash = str(cfg.get("provenance", {}).get("definitionHash", ""))
    if cfg_version != defn_version:
        problems.append(f"{rel}: version {cfg_version!r} != definition {defn_version!r}")
    if cfg_hash != defn_hash:
        problems.append(
            f"{rel}: provenance.definitionHash {cfg_hash[:12]}… != current definition "
            f"{defn_hash[:12]}… (library is stale — regenerate the library)"
        )
    print(f"  config:     version={cfg_version} definitionHash={cfg_hash[:12]}…  ({rel})")

    # Packaged submission manifest, when present.
    if bundle is not None:
        man_path = bundle / "submission-manifest.json"
        if not man_path.exists():
            problems.append(f"bundle missing submission-manifest.json: {man_path}")
        else:
            man = _load(man_path)
            man_version = str(man.get("version", ""))
            man_hash = str(man.get("provenance", {}).get("definitionHash", ""))
            if man_version != defn_version:
                problems.append(f"submission-manifest.json: version {man_version!r} != definition {defn_version!r}")
            if man_hash and man_hash != defn_hash:
                problems.append(
                    f"submission-manifest.json: provenance.definitionHash {man_hash[:12]}… != current {defn_hash[:12]}…"
                )
            print(f"  manifest:   version={man_version} definitionHash={man_hash[:12]}…")

    return problems


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("game")
    ap.add_argument("--bundle", type=Path, default=None, help="packaged bundle dir (dist-stake/<game>)")
    args = ap.parse_args(argv)

    problems = check(args.game, args.bundle)
    if problems:
        print(f"\nFAIL: version consistency for {args.game}:")
        for p in problems:
            print("  -", p)
        return 1
    scope = "definition ↔ config ↔ bundle" if args.bundle else "definition ↔ config"
    print(f"\nOK: {args.game} version consistent ({scope}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
