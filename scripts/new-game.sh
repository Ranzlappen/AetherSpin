#!/usr/bin/env bash
#
# new-game.sh — scaffold a new game from a declared MECHANIC, not a fixed clone.
#
#   --mechanic lines  -> seeds from NovaForged  (fixed paylines)
#   --mechanic ways   -> seeds from Cosmic Ways  (all-ways, no paylines)
#
# Creates a complete, immediately-runnable game (you then retune it):
#   shared/games/<id>/game-definition.json   (reference def, id/name rewritten)
#   math/games/<id>/*.py + run_config.toml   (reference SDK module, id rewritten)
#   math/games/<id>/reels/*.csv              (reference reels)
#
# Refuses to overwrite existing targets.
#
# Usage: scripts/new-game.sh <new-game-id> [--mechanic lines|ways]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

GAME_ID=""
MECHANIC="lines"
while [ $# -gt 0 ]; do
  case "$1" in
    --mechanic) MECHANIC="${2:-}"; shift 2 ;;
    --mechanic=*) MECHANIC="${1#*=}"; shift ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) GAME_ID="$1"; shift ;;
  esac
done

if [ -z "$GAME_ID" ]; then
  echo "Usage: scripts/new-game.sh <new-game-id> [--mechanic lines|ways]" >&2
  exit 1
fi

# Validate the id: lowercase letters, digits, hyphen/underscore, start with a letter.
if ! printf '%s' "$GAME_ID" | grep -Eq '^[a-z][a-z0-9_-]*$'; then
  echo "ERROR: game id '$GAME_ID' is invalid (use [a-z][a-z0-9_-]*)." >&2
  exit 1
fi

# Map the mechanic to its reference game (which already encodes engine.type,
# paylines, and a matching SDK module + reels for that mechanic).
case "$MECHANIC" in
  lines) REF_ID="novaforged" ;;
  ways)  REF_ID="cosmicways" ;;
  *) echo "ERROR: unknown mechanic '$MECHANIC' (use 'lines' or 'ways')." >&2; exit 1 ;;
esac

REF_DEF="$ROOT/shared/games/$REF_ID/game-definition.json"
REF_MATH="$ROOT/math/games/$REF_ID"
SHARED_TARGET="$ROOT/shared/games/$GAME_ID"
MATH_TARGET="$ROOT/math/games/$GAME_ID"

echo "==> Scaffolding new game '$GAME_ID' (mechanic: $MECHANIC, seeded from $REF_ID)"

for target in "$SHARED_TARGET" "$MATH_TARGET"; do
  if [ -e "$target" ]; then
    echo "ERROR: $target already exists. Refusing to overwrite." >&2
    exit 1
  fi
done
[ -f "$REF_DEF" ] || { echo "ERROR: reference definition missing: $REF_DEF" >&2; exit 1; }
[ -d "$REF_MATH" ] || { echo "ERROR: reference math game missing: $REF_MATH" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. shared/games/<id>/game-definition.json from the reference, identity rewritten.
#    engine.type + paylines are inherited from the reference (already correct
#    for the chosen mechanic), so the scaffold is valid out of the box.
# ---------------------------------------------------------------------------
mkdir -p "$SHARED_TARGET"
python3 - "$REF_DEF" "$SHARED_TARGET/game-definition.json" "$GAME_ID" "$MECHANIC" <<'PY'
import json, sys
src, dst, game_id, mechanic = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(src, encoding="utf-8") as f:
    data = json.load(f)
name = game_id.replace("-", " ").replace("_", " ").title()
data["id"] = game_id
data["displayName"] = name
data["theme"] = f"{mechanic}-custom"
data["description"] = f"Scaffolded {mechanic} game ({name}). Retune paytable, reels, RTP target, and features."
with open(dst, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
echo "==> wrote shared/games/$GAME_ID/game-definition.json"

# ---------------------------------------------------------------------------
# 2. math/games/<id>/ from the reference SDK module, reference id -> new id.
# ---------------------------------------------------------------------------
mkdir -p "$MATH_TARGET"
for src in "$REF_MATH"/*.py "$REF_MATH"/*.toml; do
  [ -f "$src" ] || continue
  sed "s/$REF_ID/$GAME_ID/g" "$src" > "$MATH_TARGET/$(basename "$src")"
done
echo "==> wrote math/games/$GAME_ID/ SDK module ($REF_ID -> $GAME_ID)"

[ -d "$REF_MATH/config" ] && cp -R "$REF_MATH/config" "$MATH_TARGET/config"
cp -R "$REF_MATH/reels" "$MATH_TARGET/reels"
echo "==> copied reels into math/games/$GAME_ID/reels/"

cat <<EOF

==> New '$MECHANIC' game '$GAME_ID' scaffolded (a runnable clone of $REF_ID).

Next steps:
  1. Retune shared/games/$GAME_ID/game-definition.json (paytable, features, RTP).
  2. Replace the reel strips in math/games/$GAME_ID/reels/*.csv.
  3. Auto-tune + gate the RTP:
       python math/scripts/optimize.py --game $GAME_ID --sims 200000 --apply
       python math/scripts/validate_rtp.py --game $GAME_ID --sims 150000 --tol 0.05 --mode all
  4. Generate + validate the library:
       python math/scripts/generate_books.py --game $GAME_ID --sims 100000
       python math/scripts/validate_books.py --game $GAME_ID
  5. Play it locally:  pnpm --filter @aetherspin/frontend dev  (then ?game=$GAME_ID)
  6. Package:          scripts/package-for-stake.sh $GAME_ID
EOF
