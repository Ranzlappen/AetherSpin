#!/usr/bin/env bash
#
# package-for-stake.sh — produce a Stake Engine dashboard upload bundle for a game.
#
# Output: dist-stake/<gameId>/
#   math/      generated RGS library (books, lookup_tables, configs, index.json)
#   frontend/  built web bundle (frontend/dist)
#   MANIFEST.md, upload-instructions.txt
# Zipped to: dist-stake/<gameId>-v<version>.zip
#
# Usage: scripts/package-for-stake.sh [gameId] [--math-only] [--dev-library] [--certified]
#   (default game: novaforged)
#   --math-only    allow a bundle without a frontend build
#   --dev-library  if math/library/<game> is missing, generate a 100k-sim
#                  STANDALONE library (dev/staging only — never submission-grade)
#   --certified    package the CERTIFIED SDK library from
#                  math/engine/games/<game>/library/ (publish_files + configs),
#                  produced by scripts/run-certification.sh. This is the
#                  submission-grade path; the SDK's own RGS verifier already
#                  validated these books (SHA-256 + payout hash).
#
set -euo pipefail
export PYTHONHASHSEED=0  # reproducible library generation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

GAME_ID="novaforged"
MATH_ONLY=0
DEV_LIBRARY=0
CERTIFIED=0
for arg in "$@"; do
  case "$arg" in
    --math-only) MATH_ONLY=1 ;;
    --dev-library) DEV_LIBRARY=1 ;;
    --certified) CERTIFIED=1 ;;
    *) GAME_ID="$arg" ;;
  esac
done

LIBRARY_DIR="$ROOT/math/library/$GAME_ID"
DEFINITION="$ROOT/shared/games/$GAME_ID/game-definition.json"
FRONTEND_DIST="$ROOT/frontend/dist"
OUT_ROOT="$ROOT/dist-stake"
OUT_DIR="$OUT_ROOT/$GAME_ID"

echo "==> Packaging '$GAME_ID' for Stake Engine upload"
echo "    repo root: $ROOT"

if [ ! -f "$DEFINITION" ]; then
  echo "ERROR: game definition not found: $DEFINITION" >&2
  echo "       Is '$GAME_ID' a valid game id? (see shared/games/)" >&2
  exit 1
fi

# Read the version from the game definition (jq preferred, python fallback).
if command -v jq >/dev/null 2>&1; then
  VERSION="$(jq -r '.version' "$DEFINITION")"
else
  VERSION="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$DEFINITION")"
fi
echo "    version:   v$VERSION"

# ---------------------------------------------------------------------------
# 1. Locate the math library.
#    --certified: use the SDK library produced by run-certification.sh
#    (publish_files + configs), staged into the standalone layout so the rest
#    of the pipeline (manifest, checksums, consistency guard) works unchanged.
#    Otherwise: use math/library/<game>, failing closed when missing — a
#    silently auto-generated 100k-sim standalone library is far too noisy for
#    a 5000x wincap title and must never end up in a real upload by accident.
# ---------------------------------------------------------------------------
SDK_LIBRARY="$ROOT/math/engine/games/$GAME_ID/library"
if [ "$CERTIFIED" -eq 1 ]; then
  if [ ! -d "$SDK_LIBRARY/publish_files" ] || [ ! -f "$SDK_LIBRARY/configs/config.json" ]; then
    echo "ERROR: no certified library at math/engine/games/$GAME_ID/library/." >&2
    echo "       Generate it first: bash scripts/run-certification.sh $GAME_ID" >&2
    exit 1
  fi
  if ! python3 -c "import json,sys; cfg=json.load(open('$SDK_LIBRARY/configs/config.json')); sys.exit(0 if cfg.get('provenance',{}).get('definitionHash') else 1)"; then
    echo "ERROR: certified config carries no provenance stamp (older run-certification.sh?)." >&2
    echo "       Re-run: bash scripts/run-certification.sh $GAME_ID" >&2
    exit 1
  fi
  echo "==> Staging CERTIFIED SDK library from math/engine/games/$GAME_ID/library ..."
  STAGED="$OUT_ROOT/.certified-stage-$GAME_ID"
  rm -rf "$STAGED"
  mkdir -p "$STAGED/books" "$STAGED/lookup_tables" "$STAGED/configs"
  cp "$SDK_LIBRARY"/publish_files/books_*.zst "$STAGED/books/"
  cp "$SDK_LIBRARY"/publish_files/lookUpTable_*.csv "$STAGED/lookup_tables/"
  cp -R "$SDK_LIBRARY/configs/." "$STAGED/configs/"
  if [ -f "$SDK_LIBRARY/publish_files/index.json" ]; then
    cp "$SDK_LIBRARY/publish_files/index.json" "$STAGED/index.json"
  fi
  LIBRARY_DIR="$STAGED"
elif [ ! -d "$LIBRARY_DIR" ] || [ -z "$(ls -A "$LIBRARY_DIR" 2>/dev/null)" ]; then
  if [ "$DEV_LIBRARY" -eq 1 ]; then
    echo "==> Math library missing; generating STANDALONE dev library (100,000 sims) ..."
    echo "    (dev/staging only — not submission-grade)"
    python3 "$ROOT/math/scripts/generate_books.py" --game "$GAME_ID" --sims 100000
  else
    echo "ERROR: no math library at math/library/$GAME_ID." >&2
    echo "" >&2
    echo "  For a SUBMISSION bundle, generate the certified library first:" >&2
    echo "      bash scripts/run-certification.sh $GAME_ID" >&2
    echo "  For a dev/staging bundle, either generate books explicitly:" >&2
    echo "      python3 math/scripts/generate_books.py --game $GAME_ID --sims <N>" >&2
    echo "  or re-run with --dev-library to auto-generate a 100k-sim library." >&2
    exit 1
  fi
fi

if [ ! -d "$LIBRARY_DIR" ]; then
  echo "ERROR: library still missing after generation: $LIBRARY_DIR" >&2
  exit 1
fi

# Fail closed on book-integrity problems before assembling an upload bundle.
# (Certified books were already validated by the SDK's own RGS verifier —
# SHA-256 + payout-hash + lookup format — during run-certification.sh.)
if [ "$CERTIFIED" -eq 1 ]; then
  echo "==> Skipping standalone book validation (SDK RGS verifier already validated the certified books)"
else
  echo "==> Validating generated books ..."
  python3 "$ROOT/math/scripts/validate_books.py" --game "$GAME_ID"
fi

# ---------------------------------------------------------------------------
# 2. Build the frontend bundle (fatal unless --math-only).
# ---------------------------------------------------------------------------
echo "==> Building frontend ..."
if [ "$MATH_ONLY" -eq 1 ]; then
  echo "    (--math-only: skipping frontend build)"
elif command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @aetherspin/frontend build  # fail-closed: a failed build aborts packaging
else
  echo "ERROR: pnpm not found; cannot build the frontend bundle." >&2
  echo "       Re-run with --math-only to produce a math-only bundle deliberately." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Assemble the bundle.
# ---------------------------------------------------------------------------
echo "==> Assembling bundle at dist-stake/$GAME_ID ..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/math"

# Copy the full library tree (books/, lookup_tables/, configs/, index.json).
cp -R "$LIBRARY_DIR/." "$OUT_DIR/math/"
if [ "$CERTIFIED" -eq 1 ]; then
  rm -rf "$OUT_ROOT/.certified-stage-$GAME_ID"
fi

FRONTEND_INCLUDED="no"
if [ -d "$FRONTEND_DIST" ] && [ -n "$(ls -A "$FRONTEND_DIST" 2>/dev/null)" ]; then
  mkdir -p "$OUT_DIR/frontend"
  cp -R "$FRONTEND_DIST/." "$OUT_DIR/frontend/"
  FRONTEND_INCLUDED="yes"
else
  echo "NOTE: no built frontend at frontend/dist; bundle contains math/ only." >&2
fi

# ---------------------------------------------------------------------------
# 4. Write upload guidance.
# ---------------------------------------------------------------------------
cat > "$OUT_DIR/MANIFEST.md" <<EOF
# Stake Engine Upload Bundle — $GAME_ID v$VERSION

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Contents

| Folder | Upload target (Stake Engine dashboard) |
| --- | --- |
| \`math/\` | **Math files** — books, lookup tables, config, index |
| \`frontend/\` | **Frontend files** — built web bundle (included: $FRONTEND_INCLUDED) |

### math/
- \`books/books_*.jsonl\` — one simulated book per line (per bet mode)
- \`lookup_tables/lookUpTable_*.csv\` — id, weight, payout (book units)
- \`lookup_tables/lookUpTableIdToCriteria_*.csv\` — id, criteria
- \`configs/config.json\` — RGS math config (modes, costs, measured RTP)
- \`index.json\` — manifest of modes -> files

### frontend/
- Static web bundle produced by \`pnpm --filter @aetherspin/frontend build\`.
EOF

cat > "$OUT_DIR/upload-instructions.txt" <<EOF
Stake Engine upload — $GAME_ID v$VERSION
==========================================

1. Open the Stake Engine dashboard for this game.
2. Under "Math files", upload the CONTENTS of the math/ folder
   (books/, lookup_tables/, configs/, index.json).
3. Under "Frontend files", upload the CONTENTS of the frontend/ folder
   (the built static bundle). [included: $FRONTEND_INCLUDED]
4. Verify the configured bet modes and RTP match configs/config.json.
5. Cross-check submission-manifest.json (gitCommit + per-file sha256) and
   SHA256SUMS against the uploaded files; attach sbom.cdx.json for review.
EOF

# ---------------------------------------------------------------------------
# 4b. Certification artifacts: checksums, submission manifest, SBOM.
# ---------------------------------------------------------------------------
echo "==> Writing certification artifacts (manifest, checksums, SBOM) ..."
python3 "$ROOT/scripts/make_submission_artifacts.py" \
  --bundle-dir "$OUT_DIR" --game "$GAME_ID" --version "$VERSION"

# ---------------------------------------------------------------------------
# 4c. Fail closed if the bundle's version/provenance drifts from the definition
#     (e.g. a stale math library packaged against a newer definition).
# ---------------------------------------------------------------------------
echo "==> Verifying version consistency (definition ↔ config ↔ bundle) ..."
python3 "$ROOT/scripts/check-version-consistency.py" "$GAME_ID" --bundle "$OUT_DIR" || {
  echo "ERROR: bundle failed version-consistency check — regenerate the math library and re-package." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# 4d. Independently re-verify SHA256SUMS: re-hash every bundle file and confirm
#     it matches the manifest. This detects any tampering/corruption between the
#     build and this point, so the checksums shipped to the lab are provably
#     consistent with the exact bytes packaged. Fail closed on any mismatch.
# ---------------------------------------------------------------------------
echo "==> Re-verifying bundle checksums (SHA256SUMS ↔ packaged bytes) ..."
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$OUT_DIR" && sha256sum -c --strict --quiet SHA256SUMS ) || {
    echo "ERROR: bundle checksum verification failed — a file changed after packaging." >&2
    exit 1
  }
else
  # Portable fallback (macOS / no coreutils): re-hash in Python.
  python3 - "$OUT_DIR" <<'PY' || { echo "ERROR: bundle checksum verification failed." >&2; exit 1; }
import hashlib, sys
from pathlib import Path
bundle = Path(sys.argv[1])
sums = bundle / "SHA256SUMS"
bad = 0
for line in sums.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line:
        continue
    digest, rel = line.split(None, 1)
    f = bundle / rel
    if not f.is_file():
        print(f"  MISSING: {rel}"); bad += 1; continue
    h = hashlib.sha256()
    with f.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    if h.hexdigest() != digest:
        print(f"  MISMATCH: {rel}"); bad += 1
if bad:
    print(f"{bad} checksum problem(s).")
    sys.exit(1)
print("  all bundle files match SHA256SUMS")
PY
fi

# ---------------------------------------------------------------------------
# 5. Zip it.
# ---------------------------------------------------------------------------
ZIP_PATH="$OUT_ROOT/$GAME_ID-v$VERSION.zip"
rm -f "$ZIP_PATH"
echo "==> Zipping -> dist-stake/$GAME_ID-v$VERSION.zip ..."
if command -v zip >/dev/null 2>&1; then
  ( cd "$OUT_ROOT" && zip -rq "$GAME_ID-v$VERSION.zip" "$GAME_ID" )
else
  # Fallback to python's zipfile if the zip binary is unavailable.
  python3 - "$OUT_DIR" "$ZIP_PATH" "$GAME_ID" <<'PY'
import sys, zipfile, os
out_dir, zip_path, game_id = sys.argv[1], sys.argv[2], sys.argv[3]
base = os.path.dirname(out_dir)
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(out_dir):
        for fn in files:
            full = os.path.join(root, fn)
            z.write(full, os.path.relpath(full, base))
PY
fi

echo ""
echo "==> Done."
echo "    Bundle dir: dist-stake/$GAME_ID"
echo "    Zip:        dist-stake/$GAME_ID-v$VERSION.zip"
echo "    See dist-stake/$GAME_ID/upload-instructions.txt for next steps."
