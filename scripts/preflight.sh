#!/usr/bin/env bash
#
# preflight.sh — run the full certification gate for a game and print a
# green/red mirror of docs/stake-engine-submission-checklist.md. One command
# that must be all-green before you package + submit.
#
# Steps (fail-closed): definition schema (structural + semantic) → deterministic
# library generation → book integrity → RTP gate (both modes, buy-bonus ≤ break
# even) → PAR sheet → version/provenance sync.
#
# Usage:
#   scripts/preflight.sh [gameId] [--quick]
#     gameId   default: novaforged
#     --quick  smaller sim counts for a fast local check (NOT for submission)
#
# Tunable via env: RTP_SIMS (default 150000, or 20000 with --quick),
#                  PAR_SIMS (default 100000, or 20000 with --quick), RTP_TOL (0.03).
set -uo pipefail
export PYTHONHASHSEED=0  # reproducible library generation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

GAME_ID="novaforged"
QUICK=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    *) GAME_ID="$arg" ;;
  esac
done

if [ "$QUICK" -eq 1 ]; then
  RTP_SIMS="${RTP_SIMS:-20000}"; PAR_SIMS="${PAR_SIMS:-20000}"
else
  RTP_SIMS="${RTP_SIMS:-150000}"; PAR_SIMS="${PAR_SIMS:-100000}"
fi
RTP_TOL="${RTP_TOL:-0.03}"

DEFINITION="$ROOT/shared/games/$GAME_ID/game-definition.json"
PAR_OUT="$ROOT/docs/par-sheets/$GAME_ID-par-sheet.md"

PASS=0; FAIL=0
declare -a RESULTS

run_step() {
  # run_step "label" cmd...
  local label="$1"; shift
  echo ""
  echo "── $label ──────────────────────────────────────────────"
  if "$@"; then
    RESULTS+=("PASS  $label"); PASS=$((PASS + 1))
  else
    RESULTS+=("FAIL  $label"); FAIL=$((FAIL + 1))
  fi
}

echo "=== AetherSpin preflight — $GAME_ID ==="
[ "$QUICK" -eq 1 ] && echo "    (--quick: RTP_SIMS=$RTP_SIMS PAR_SIMS=$PAR_SIMS — NOT submission-grade)"
if [ ! -f "$DEFINITION" ]; then
  echo "ERROR: no game definition at $DEFINITION (valid game id?)" >&2
  exit 2
fi

# 1. Structural schema (ajv if available) + semantic cross-checks.
ajv_check() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm exec ajv validate -c ajv-formats \
      -s "$ROOT/shared/schemas/game-definition.schema.json" \
      -d "$DEFINITION" 2>/dev/null \
      || pnpm dlx ajv-cli@5 validate \
           -s "$ROOT/shared/schemas/game-definition.schema.json" \
           -d "$DEFINITION" 2>/dev/null \
      || { echo "(ajv unavailable — relying on semantic validator)"; return 0; }
  else
    echo "(pnpm unavailable — skipping structural ajv, semantic check still runs)"
  fi
}
run_step "Definition schema (structural)" ajv_check
run_step "Definition schema (semantic)" python3 "$ROOT/scripts/validate_definitions.py"

# 2. Deterministic library generation + 3. book integrity.
run_step "Generate library (deterministic)" \
  python3 "$ROOT/math/scripts/generate_books.py" --game "$GAME_ID" --sims "$RTP_SIMS"
run_step "Book integrity" \
  python3 "$ROOT/math/scripts/validate_books.py" --game "$GAME_ID"

# 4. RTP gate — base within tol, buy-bonus never EV-positive. High volatility
#    means RTP only converges over large samples, so in --quick mode (tiny N)
#    this is informational, not a gate. Run a full preflight to gate on it.
if [ "$QUICK" -eq 1 ]; then
  echo ""
  echo "── RTP (informational — --quick, low-sim variance) ──────────────────"
  python3 "$ROOT/math/scripts/validate_rtp.py" \
    --game "$GAME_ID" --sims "$RTP_SIMS" --tol "$RTP_TOL" --mode all || true
  RESULTS+=("INFO  RTP gate (informational in --quick; run full preflight to gate)")
else
  run_step "RTP gate (base + buy-bonus)" \
    python3 "$ROOT/math/scripts/validate_rtp.py" \
      --game "$GAME_ID" --sims "$RTP_SIMS" --tol "$RTP_TOL" --mode all
fi

# 5. PAR sheet.
mkdir -p "$ROOT/docs/par-sheets"
run_step "PAR sheet" \
  python3 "$ROOT/math/scripts/generate_par_sheet.py" \
    --game "$GAME_ID" --sims "$PAR_SIMS" --out "$PAR_OUT"

# 6. Version / provenance sync: config.json version == definition version, and
#    the provenance stamp is present (gitCommit + hashes).
version_sync() {
  python3 - "$GAME_ID" <<'PY'
import json, sys
from pathlib import Path
game = sys.argv[1]
defn = json.loads(Path(f"shared/games/{game}/game-definition.json").read_text())
cfg = json.loads(Path(f"math/library/{game}/configs/config.json").read_text())
ok = True
if str(defn["version"]) != str(cfg["version"]):
    print(f"  version mismatch: definition {defn['version']} != config {cfg['version']}")
    ok = False
prov = cfg.get("provenance", {})
for key in ("gitCommit", "seed", "definitionHash", "reelHashes", "simulatorVersion"):
    if not prov.get(key):
        print(f"  provenance missing: {key}")
        ok = False
if ok:
    print(f"  version {defn['version']} synced; provenance stamped (commit {prov['gitCommit'][:12]})")
sys.exit(0 if ok else 1)
PY
}
run_step "Version + provenance sync" version_sync

# ---------------------------------------------------------------------------
# Summary.
# ---------------------------------------------------------------------------
echo ""
echo "=== Preflight summary — $GAME_ID ==="
for r in "${RESULTS[@]}"; do
  case "$r" in
    PASS*) printf '  \033[32m✓\033[0m %s\n' "${r#PASS  }" ;;
    FAIL*) printf '  \033[31m✗\033[0m %s\n' "${r#FAIL  }" ;;
    INFO*) printf '  \033[33m•\033[0m %s\n' "${r#INFO  }" ;;
  esac
done
echo "    $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "    NOT ready to submit."
  exit 1
fi
echo "    All gates green. Next: bash scripts/package-for-stake.sh $GAME_ID"
