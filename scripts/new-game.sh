#!/usr/bin/env bash
#
# new-game.sh — scaffold a new game from the template + novaforged reference.
#
# Creates:
#   shared/games/<id>/game-definition.json   (from template, id set)
#   math/games/<id>/*.py + run_config.toml   (from novaforged, "novaforged" -> <id>)
#   math/games/<id>/reels/*.csv              (copied from novaforged)
#
# Refuses to overwrite existing targets (idempotent-safe).
#
# Usage: scripts/new-game.sh <new-game-id>
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

if [ $# -lt 1 ] || [ -z "${1:-}" ]; then
  echo "Usage: scripts/new-game.sh <new-game-id>" >&2
  exit 1
fi

GAME_ID="$1"

# Validate the id: lowercase letters, digits, hyphen/underscore.
if ! printf '%s' "$GAME_ID" | grep -Eq '^[a-z][a-z0-9_-]*$'; then
  echo "ERROR: game id '$GAME_ID' is invalid." >&2
  echo "       Use lowercase letters/digits/_/- and start with a letter." >&2
  exit 1
fi

TEMPLATE_DEF="$ROOT/shared/games/template/game-definition.json"
REF_MATH="$ROOT/math/games/novaforged"

SHARED_TARGET="$ROOT/shared/games/$GAME_ID"
MATH_TARGET="$ROOT/math/games/$GAME_ID"

echo "==> Scaffolding new game: $GAME_ID"

# Refuse if either target already exists.
if [ -e "$SHARED_TARGET" ]; then
  echo "ERROR: $SHARED_TARGET already exists. Refusing to overwrite." >&2
  exit 1
fi
if [ -e "$MATH_TARGET" ]; then
  echo "ERROR: $MATH_TARGET already exists. Refusing to overwrite." >&2
  exit 1
fi
if [ ! -f "$TEMPLATE_DEF" ]; then
  echo "ERROR: template definition missing: $TEMPLATE_DEF" >&2
  exit 1
fi
if [ ! -d "$REF_MATH" ]; then
  echo "ERROR: reference math game missing: $REF_MATH" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. shared/games/<id>/game-definition.json from the template, id replaced.
# ---------------------------------------------------------------------------
mkdir -p "$SHARED_TARGET"
python3 - "$TEMPLATE_DEF" "$SHARED_TARGET/game-definition.json" "$GAME_ID" <<'PY'
import json, sys
src, dst, game_id = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src, encoding="utf-8") as f:
    data = json.load(f)
data["id"] = game_id
data["displayName"] = game_id.replace("-", " ").replace("_", " ").title()
with open(dst, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
echo "==> wrote shared/games/$GAME_ID/game-definition.json"

# ---------------------------------------------------------------------------
# 2. math/games/<id>/ from novaforged, replacing the game_id string.
# ---------------------------------------------------------------------------
mkdir -p "$MATH_TARGET"
# Copy python entry points + run_config.toml, substituting "novaforged" -> <id>.
for src in "$REF_MATH"/*.py "$REF_MATH"/*.toml; do
  [ -f "$src" ] || continue
  base="$(basename "$src")"
  sed "s/novaforged/$GAME_ID/g" "$src" > "$MATH_TARGET/$base"
done
echo "==> wrote math/games/$GAME_ID/ python entry points (game_id -> $GAME_ID)"

# Copy the config/ dir verbatim if present.
if [ -d "$REF_MATH/config" ]; then
  cp -R "$REF_MATH/config" "$MATH_TARGET/config"
  echo "==> copied math/games/$GAME_ID/config/"
fi

# Copy reels.
if [ -d "$REF_MATH/reels" ]; then
  cp -R "$REF_MATH/reels" "$MATH_TARGET/reels"
  echo "==> copied template reels into math/games/$GAME_ID/reels/"
fi

echo ""
echo "==> New game '$GAME_ID' scaffolded."
echo ""
echo "Next steps:"
echo "  1. Tune the math in shared/games/$GAME_ID/game-definition.json"
echo "     (paytable, paylines, RTP target, volatility, features)."
echo "  2. Tune the reel strips in math/games/$GAME_ID/reels/*.csv."
echo "  3. Simulate / validate RTP:"
echo "       python math/scripts/validate_rtp.py --game $GAME_ID --sims 200000 --tol 0.05"
echo "  4. Generate the library:"
echo "       python math/scripts/generate_books.py --game $GAME_ID --sims 100000"
echo "  5. Package for Stake Engine:"
echo "       scripts/package-for-stake.sh $GAME_ID"
