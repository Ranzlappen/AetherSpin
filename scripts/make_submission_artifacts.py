#!/usr/bin/env python3
"""Write certification artifacts into a Stake Engine upload bundle.

Given an assembled bundle directory (``dist-stake/<game>/``), emit:

- ``SHA256SUMS``            — sha256 of every bundle file (tamper/parity check).
- ``submission-manifest.json`` — single source of truth for a submission:
  game id/version, the source ``gitCommit``, the math provenance stamp, engine
  parameters, and a hash for every artifact. Lets a lab tie the uploaded bytes
  to an exact commit + seed and re-verify them.
- ``sbom.cdx.json``        — a CycloneDX 1.5 SBOM of the project's *direct*
  dependencies (npm workspaces + Python requirements).

Stdlib only. Intended to be called by ``package-for-stake.sh`` but usable
standalone:  ``python3 scripts/make_submission_artifacts.py --bundle-dir dist-stake/novaforged --game novaforged``
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files this script itself writes — excluded from the checksum/manifest pass so
# the manifest never tries to hash itself.
GENERATED = {"SHA256SUMS", "submission-manifest.json", "sbom.cdx.json"}


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _bundle_files(bundle_dir: Path) -> list[Path]:
    return sorted(
        p
        for p in bundle_dir.rglob("*")
        if p.is_file() and p.name not in GENERATED
    )


def write_checksums(bundle_dir: Path, files: list[Path]) -> dict[str, str]:
    """Write SHA256SUMS (coreutils format) and return {relpath: sha256}."""
    hashes: dict[str, str] = {}
    lines = []
    for f in files:
        rel = f.relative_to(bundle_dir).as_posix()
        digest = _sha256(f)
        hashes[rel] = digest
        lines.append(f"{digest}  {rel}")
    (bundle_dir / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return hashes


def _read_config(bundle_dir: Path) -> dict:
    cfg = bundle_dir / "math" / "configs" / "config.json"
    if cfg.is_file():
        return json.loads(cfg.read_text(encoding="utf-8"))
    return {}


def write_manifest(
    bundle_dir: Path, game: str, version: str, hashes: dict[str, str]
) -> None:
    config = _read_config(bundle_dir)
    manifest = {
        "manifestVersion": "1.0",
        "gameId": game,
        "version": version,
        "generatedAt": _now(),
        "source": {
            "gitCommit": config.get("provenance", {}).get("gitCommit", "unknown"),
        },
        "engine": {
            "rtpTarget": config.get("rtpTarget"),
            "wincap": config.get("wincap"),
            "bookAmountMultiplier": config.get("bookAmountMultiplier"),
            "betModes": config.get("betModes"),
        },
        "provenance": config.get("provenance", {}),
        "artifacts": [
            {"path": rel, "sha256": digest} for rel, digest in sorted(hashes.items())
        ],
        # Lab/compliance fills these in at sign-off; present so the schema is stable.
        "signOff": {
            "mathReviewer": None,
            "complianceReviewer": None,
            "date": None,
        },
    }
    (bundle_dir / "submission-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def _npm_components() -> list[dict]:
    """Direct npm deps across the workspaces, as CycloneDX components."""
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for pkg_path in [
        ROOT / "package.json",
        ROOT / "frontend" / "package.json",
        ROOT / "shared" / "package.json",
    ]:
        if not pkg_path.is_file():
            continue
        pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
        for field in ("dependencies", "devDependencies"):
            for name, spec in (pkg.get(field) or {}).items():
                ver = re.sub(r"^[\^~>=<\s]*", "", str(spec))
                if (name, ver) in seen:
                    continue
                seen.add((name, ver))
                out.append(
                    {
                        "type": "library",
                        "name": name,
                        "version": ver,
                        "purl": f"pkg:npm/{name}@{ver}",
                        "scope": "optional" if field == "devDependencies" else "required",
                    }
                )
    return out


def _pip_components() -> list[dict]:
    """Direct Python deps from math/requirements.txt as CycloneDX components."""
    out: list[dict] = []
    req = ROOT / "math" / "requirements.txt"
    if not req.is_file():
        return out
    for raw in req.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z0-9_.\-]+)\s*([<>=!~]+)?\s*([0-9A-Za-z.\-]+)?", line)
        if not m:
            continue
        name = m.group(1)
        ver = m.group(3) or ""
        comp = {"type": "library", "name": name, "purl": f"pkg:pypi/{name}"}
        if ver:
            comp["version"] = ver
            comp["purl"] = f"pkg:pypi/{name}@{ver}"
        out.append(comp)
    return out


def write_sbom(bundle_dir: Path, game: str, version: str) -> None:
    components = _npm_components() + _pip_components()
    sbom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {
            "timestamp": _now(),
            "component": {
                "type": "application",
                "name": f"aetherspin-{game}",
                "version": version,
            },
            "properties": [
                {
                    "name": "aetherspin:scope",
                    "value": "direct-dependencies-only",
                }
            ],
        },
        "components": components,
    }
    (bundle_dir / "sbom.cdx.json").write_text(
        json.dumps(sbom, indent=2) + "\n", encoding="utf-8"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bundle-dir", required=True, help="assembled dist-stake/<game> dir")
    ap.add_argument("--game", required=True)
    ap.add_argument("--version", required=True)
    args = ap.parse_args()

    bundle_dir = Path(args.bundle_dir).resolve()
    if not bundle_dir.is_dir():
        raise SystemExit(f"bundle dir not found: {bundle_dir}")

    files = _bundle_files(bundle_dir)
    hashes = write_checksums(bundle_dir, files)
    write_manifest(bundle_dir, args.game, args.version, hashes)
    write_sbom(bundle_dir, args.game, args.version)

    print(
        f"    submission-manifest.json ({len(hashes)} artifacts), "
        f"SHA256SUMS, sbom.cdx.json written"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
