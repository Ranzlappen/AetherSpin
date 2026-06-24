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
# Usage: scripts/package-for-stake.sh [gameId]   (default: novaforged)
#
set -euo pipefail
export PYTHONHASHSEED=0  # reproducible library generation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# Args: <gameId> [--math-only]. --math-only allows a bundle without a frontend.
GAME_ID="novaforged"
MATH_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --math-only) MATH_ONLY=1 ;;
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
# 1. Ensure the math library exists; generate it if missing.
# ---------------------------------------------------------------------------
if [ ! -d "$LIBRARY_DIR" ] || [ -z "$(ls -A "$LIBRARY_DIR" 2>/dev/null)" ]; then
  echo "==> Math library missing; generating (100,000 sims) ..."
  python3 "$ROOT/math/scripts/generate_books.py" --game "$GAME_ID" --sims 100000
fi

if [ ! -d "$LIBRARY_DIR" ]; then
  echo "ERROR: library still missing after generation: $LIBRARY_DIR" >&2
  exit 1
fi

# Fail closed on book-integrity problems before assembling an upload bundle.
echo "==> Validating generated books ..."
python3 "$ROOT/math/scripts/validate_books.py" --game "$GAME_ID"

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
