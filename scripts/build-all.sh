#!/usr/bin/env bash
#
# build-all.sh — the "one-command" end-to-end build:
#   1. validate RTP (gate, both bet modes)
#   2. generate the math library (books)
#   3. validate the generated books (integrity gate)
#   4. build the frontend
#
# Usage: scripts/build-all.sh [gameId] [sims]
#   gameId  default: novaforged
#   sims    base-game simulations for book generation (default: 100000)
#
set -euo pipefail
export PYTHONHASHSEED=0  # reproducible library generation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

GAME_ID="${1:-novaforged}"
SIMS="${2:-100000}"

echo "=============================================="
echo " AetherSpin build-all :: game=$GAME_ID sims=$SIMS"
echo "=============================================="

# ---------------------------------------------------------------------------
# 1. Validate RTP (gate the build).
# ---------------------------------------------------------------------------
echo ""
echo "==> [1/4] Validating RTP (base + buy-bonus) ..."
python3 "$ROOT/math/scripts/validate_rtp.py" --game "$GAME_ID" --sims "$SIMS" --tol 0.05 --mode all

# ---------------------------------------------------------------------------
# 2. Generate the math library (books, lookup tables, configs).
# ---------------------------------------------------------------------------
echo ""
echo "==> [2/4] Generating math library ..."
python3 "$ROOT/math/scripts/generate_books.py" --game "$GAME_ID" --sims "$SIMS"

# ---------------------------------------------------------------------------
# 3. Validate generated book integrity (ids, wincap, event ordering/schema).
# ---------------------------------------------------------------------------
echo ""
echo "==> [3/4] Validating generated books ..."
python3 "$ROOT/math/scripts/validate_books.py" --game "$GAME_ID"

# ---------------------------------------------------------------------------
# 4. Build the frontend.
# ---------------------------------------------------------------------------
echo ""
echo "==> [4/4] Building frontend ..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @aetherspin/frontend build
else
  echo "WARNING: pnpm not found; skipping frontend build." >&2
fi

echo ""
echo "==> build-all complete for '$GAME_ID'."
echo "    Math library: math/library/$GAME_ID/"
echo "    Frontend:     frontend/dist/"
echo "    Package for upload with: scripts/package-for-stake.sh $GAME_ID"
