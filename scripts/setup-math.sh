#!/usr/bin/env bash
#
# setup-math.sh — fetch the official StakeEngine math-sdk and wire the AetherSpin
# game files into it so the SDK pipeline (Rust optimizer, certification reports)
# can run against our games.
#
# Idempotent: safe to re-run. The cloned engine lives in math/engine/ which is
# gitignored.
#
set -euo pipefail

# Resolve repo root regardless of where this is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

SDK_URL="https://github.com/StakeEngine/math-sdk"
ENGINE_DIR="$ROOT/math/engine"
GAMES_DIR="$ROOT/math/games"
SHARED_GAMES_DIR="$ROOT/shared/games"

echo "==> AetherSpin math-sdk setup"
echo "    repo root: $ROOT"
echo "    engine:    $ENGINE_DIR"

# ---------------------------------------------------------------------------
# 1. Clone the official math-sdk if absent.
# ---------------------------------------------------------------------------
if [ -d "$ENGINE_DIR/.git" ]; then
  echo "==> math-sdk already present at math/engine (skipping clone)."
elif [ -d "$ENGINE_DIR" ] && [ -n "$(ls -A "$ENGINE_DIR" 2>/dev/null)" ]; then
  echo "==> math/engine exists and is non-empty but is not a git checkout."
  echo "    Leaving it untouched. Remove it and re-run to re-clone."
else
  if ! command -v git >/dev/null 2>&1; then
    echo "ERROR: git is not installed. Install git and re-run." >&2
    exit 1
  fi
  echo "==> Cloning $SDK_URL -> math/engine ..."
  if ! git clone --depth 1 "$SDK_URL" "$ENGINE_DIR"; then
    echo "" >&2
    echo "ERROR: clone failed (no network access or the URL is unreachable)." >&2
    echo "       You can clone manually later:" >&2
    echo "         git clone $SDK_URL math/engine" >&2
    echo "       then re-run this script to finish the symlink wiring." >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Symlink each AetherSpin game into the SDK's games/ directory.
# ---------------------------------------------------------------------------
SDK_GAMES_DIR="$ENGINE_DIR/games"
mkdir -p "$SDK_GAMES_DIR"

if [ -d "$GAMES_DIR" ]; then
  for game_path in "$GAMES_DIR"/*/; do
    [ -d "$game_path" ] || continue
    game_id="$(basename "$game_path")"
    # Skip the bare template (no python entry points).
    if [ "$game_id" = "template" ]; then
      continue
    fi
    link="$SDK_GAMES_DIR/$game_id"
    if [ -L "$link" ] || [ -e "$link" ]; then
      rm -rf "$link"
    fi
    ln -s "$game_path" "$link"
    echo "==> linked game: math/engine/games/$game_id -> math/games/$game_id"
  done
fi

# ---------------------------------------------------------------------------
# 3. Symlink the shared game definitions so SDK game files can resolve them.
# ---------------------------------------------------------------------------
if [ -d "$SHARED_GAMES_DIR" ]; then
  SHARED_LINK="$ENGINE_DIR/shared-games"
  if [ -L "$SHARED_LINK" ] || [ -e "$SHARED_LINK" ]; then
    rm -rf "$SHARED_LINK"
  fi
  ln -s "$SHARED_GAMES_DIR" "$SHARED_LINK"
  echo "==> linked shared definitions: math/engine/shared-games -> shared/games"
fi

echo ""
echo "==> Done."
echo ""
echo "Next steps:"
echo "  1. Install the SDK's own Python deps:"
echo "       pip install -r math/engine/requirements.txt"
echo "  2. (Optional) Build the Rust optimizer per the SDK README in math/engine/."
echo "  3. Run a game through the SDK pipeline, e.g.:"
echo "       cd math/engine && python games/novaforged/run.py"
echo ""
echo "  For fast local iteration without the SDK, use the standalone engine:"
echo "       python math/scripts/generate_books.py --game novaforged --sims 1000000"
