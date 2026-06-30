#!/usr/bin/env bash
#
# run-certification.sh <game> — produce the CERTIFIED math library for a game by
# running the full official-SDK pipeline INCLUDING the Rust optimizer:
#   OptimizationSetup → create_books → generate_configs → optimizer → verify.
#
# This is the one step that needs the SDK's heavier toolchain (Python 3.12 + a
# Rust toolchain). Where those are present it runs to completion and the
# optimized lookup tables hit the target RTP exactly; where they're absent it
# SKIPs with exit 0 and clear guidance (so it's safe to call from anywhere).
#
#   scripts/run-certification.sh novaforged
#   SDK_BASE_SIMS=100000 SDK_BONUS_SIMS=40000 scripts/run-certification.sh novaforged   # quick run
#
# Output: math/engine/games/<game>/library/ (publish_files/ holds the certified
# books + optimized lookup tables). Then: bash scripts/package-for-stake.sh <game>.
set -uo pipefail

GAME="${1:-novaforged}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"
ENGINE="$ROOT/math/engine"
export PYTHONHASHSEED=0

skip() {
  echo "SKIP (certification, $GAME): $1"
  echo "       The certified run needs Python 3.12 + a Rust toolchain (cargo);"
  echo "       see docs/sdk-certification-runbook.md."
  exit 0
}

# Python 3.12 is the SDK's required interpreter (it uses 3.12-only syntax).
PY="$(command -v python3.12 || true)"
[ -n "$PY" ] || skip "python3.12 not found"
command -v cargo >/dev/null 2>&1 || skip "Rust toolchain (cargo) not found"

# Vendor the SDK if needed (fail-soft).
if [ ! -d "$ENGINE/src" ]; then
  echo "==> fetching math-sdk (scripts/setup-math.sh)…"
  bash scripts/setup-math.sh >/tmp/sdk-setup.log 2>&1 || skip "math-sdk fetch/setup failed (no network?)"
fi
[ -f "$ENGINE/games/$GAME/run.py" ] || skip "game '$GAME' not linked into the SDK"
[ -f "$ENGINE/optimization_program/Cargo.toml" ] || skip "vendored SDK has no optimization_program"

# SDK runtime deps for the 3.12 interpreter (PEP 668 external env → break-system).
echo "==> ensuring Python 3.12 SDK deps…"
"$PY" -m pip install -q --break-system-packages numpy zstandard python-dotenv xlsxwriter >/tmp/sdk-pip312.log 2>&1 || true
"$PY" -c "import numpy, zstandard, dotenv, xlsxwriter" 2>/dev/null || skip "could not import SDK deps under python3.12"

# Run the certified pipeline from the engine root using the game's real path so
# the shared definition resolves; library writes under <game>/library/.
echo "==> running the certified pipeline for $GAME (create_books + Rust optimizer)…"
rm -rf "$ENGINE/games/$GAME/library"
(
  cd "$ENGINE"
  PYTHONPATH="$ENGINE" PYTHONHASHSEED=0 "$PY" "games/$GAME/run.py"
) || { echo "FAIL: certified pipeline errored for $GAME."; exit 1; }

# Report the post-optimization RTP from the optimized lookup tables.
"$PY" - "$GAME" <<'PY'
import sys, csv, glob, os
sys.path.insert(0, "math/games/" + sys.argv[1])
from game_config import GameConfig
cfg = GameConfig()
game = sys.argv[1]
print("\n=== certified post-optimization RTP ===")
for i, mode in enumerate(("base", "bonus")):
    cost = 1.0 if mode == "base" else cfg.bet_modes[1].get_cost()
    lut = sorted(glob.glob(f"math/engine/games/{game}/library/publish_files/lookUpTable_{mode}_*.csv"))
    if not lut:
        print(f"  [{mode}] no optimized lookup table"); continue
    wsum = psum = 0.0
    for r in csv.reader(open(lut[0])):
        if len(r) < 3:
            continue
        w = float(r[1]); p = float(r[2]) / 100.0
        wsum += w; psum += w * p
    rtp = (psum / wsum / cost) if wsum else 0.0
    print(f"  [{mode}] RTP = {rtp:.4f}  (target {cfg.rtp}, cost {cost})")
PY

echo
echo "==> certification[$GAME]: DONE — library at math/engine/games/$GAME/library/"
echo "    Next: bash scripts/package-for-stake.sh $GAME"
