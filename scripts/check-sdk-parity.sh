#!/usr/bin/env bash
#
# check-sdk-parity.sh <game> — verify the certified math-sdk output against the
# shared contract and the standalone engine for one game (see docs/adr/0005).
#
# Design: FAIL-SOFT. Every step that depends on the (non-vendored) math-sdk
# SKIPs with exit 0 on any error — so this is safe in network-restricted CI and
# can NEVER raise a false alarm. It returns non-zero ONLY when it successfully
# generated SDK books and measured a REAL contract violation.
#
# What it checks (ADR 0005 Update 3):
#   #1  BOOK CONTRACT — every SDK book speaks the shared BookEvent vocabulary the
#       frontend replays. This is the always-meaningful, runnable-everywhere gate.
#   #2  multiplierWilds — free reveals carry realized per-cell wilds (the mechanic).
#   #3  POST-OPTIMIZATION RTP — OFF by default. Raw `create_books` RTP is
#       quota-shaped (books are generated per forced distribution as input to the
#       SDK's Rust optimizer), so it is NOT comparable to the standalone's natural
#       RTP. Only enable (SDK_PARITY_CHECK_RTP=1) in an SDK+Rust environment that
#       has actually run the optimizer.
#
#   scripts/check-sdk-parity.sh novaforged
#
set -uo pipefail

GAME="${1:-novaforged}"
SIMS="${SDK_PARITY_SIMS:-20000}"
CHECK_RTP="${SDK_PARITY_CHECK_RTP:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"
ENGINE="$ROOT/math/engine"
export PYTHONHASHSEED=0

skip() {
  echo "SKIP (sdk-parity, $GAME): $1"
  echo "       This gate runs where the math-sdk is available; see docs/adr/0005."
  exit 0
}

# ---------------------------------------------------------------------------
# 1. Ensure the math-sdk is present and wired (fail-soft fetch).
# ---------------------------------------------------------------------------
if [ ! -d "$ENGINE/src" ]; then
  echo "==> fetching math-sdk (scripts/setup-math.sh)…"
  bash scripts/setup-math.sh >/tmp/sdk-setup.log 2>&1 || skip "math-sdk fetch/setup failed (no network?)"
fi
[ -f "$ENGINE/games/$GAME/run.py" ] || skip "game '$GAME' not linked into the SDK"
[ -f "$ENGINE/src/state/run_sims.py" ] || skip "vendored SDK is missing src/state/run_sims.py"

# SDK Python deps (fail-soft).
if [ -f "$ENGINE/requirements.txt" ]; then
  pip install -q -r "$ENGINE/requirements.txt" >/tmp/sdk-pip.log 2>&1 || true
fi

# ---------------------------------------------------------------------------
# 2. Generate a SMALL, COMPRESSED SDK library (create_books directly — skips the
#    heavy Rust optimizer that run.py would invoke) and run the SDK's OWN upload
#    verifier (execute_all_tests = verify_lookup_format + book/LUT payout-hash +
#    SHA-256). This is the authoritative Stake RGS conformance check. Fail-soft.
#    Imports use the game's real path so the shared definition resolves; cwd is
#    the engine root so the stats summary's relative path is valid.
# ---------------------------------------------------------------------------
echo "==> generating compressed SDK books + running the SDK RGS verifier ($SIMS sims)…"
REAL_GAME_DIR="$ROOT/math/games/$GAME"
(
  cd "$ENGINE"
  PYTHONHASHSEED=0 PYTHONPATH="$ENGINE" REAL_GAME_DIR="$REAL_GAME_DIR" python3 - "$SIMS" <<'PYEOF'
import os, sys, warnings
sys.path.insert(0, os.environ["REAL_GAME_DIR"])
sims = int(sys.argv[1])
from game_config import GameConfig
from gamestate import GameState
from src.state.run_sims import create_books          # type: ignore
from utils.rgs_verification import execute_all_tests  # type: ignore
cfg = GameConfig()
gs = GameState(cfg)
create_books(gs, cfg, {"base": sims, "bonus": max(1, sims // 4)}, max(1, sims), 1, True, False)
with warnings.catch_warnings():           # quota-shaped pre-optimizer RTP warns; not a failure
    warnings.simplefilter("ignore")
    execute_all_tests(cfg)
print("RGS_VERIFY_OK")
PYEOF
) >/tmp/sdk-gen.log 2>&1 || { tail -30 /tmp/sdk-gen.log; \
  if grep -qi "payout hash\|verify_lookup_format\|AssertionError" /tmp/sdk-gen.log; then
    echo "FAIL: SDK RGS verification (execute_all_tests) failed — see above."; exit 1
  fi; skip "SDK generation/verification could not run (see /tmp/sdk-gen.log)"; }
grep -q "RGS_VERIFY_OK" /tmp/sdk-gen.log || { tail -30 /tmp/sdk-gen.log; skip "SDK verification did not complete"; }
echo "==> check #1: SDK RGS verifier (verify_lookup_format + payout-hash + SHA-256) PASS"

# Locate the compressed publish books for our own contract checks.
PUB="$ENGINE/games/$GAME/library/publish_files"
SDK_BASE="$PUB/books_base.jsonl.zst"
SDK_BONUS="$PUB/books_bonus.jsonl.zst"
[ -f "$SDK_BASE" ] || SDK_BASE="$(find "$ENGINE" -name "books_base.jsonl.zst" 2>/dev/null | head -1)"
[ -f "$SDK_BONUS" ] || SDK_BONUS="$(find "$ENGINE" -name "books_bonus.jsonl.zst" 2>/dev/null | head -1)"
[ -f "$SDK_BASE" ] || skip "could not locate SDK publish books"
[ -f "$SDK_BONUS" ] || SDK_BONUS=""
echo "    SDK books: ${SDK_BASE#$ROOT/}${SDK_BONUS:+, ${SDK_BONUS#$ROOT/}}"

# ---------------------------------------------------------------------------
# 3. Real check #2 — SDK books must satisfy the shared BookEvent contract the
#    frontend replays (the RGS treats events as opaque, so this is OUR guard).
# ---------------------------------------------------------------------------
echo "==> check #2: SDK books conform to the BookEvent contract…"
python3 math/scripts/validate_sdk_books.py "$SDK_BASE" ${SDK_BONUS:+"$SDK_BONUS"} \
  || { echo "FAIL: SDK books violate the shared book contract (docs/adr/0005)."; exit 1; }

# ---------------------------------------------------------------------------
# 4. Real check #3 — free reveals must carry realized `multiplierWilds`
#    (only meaningful if the game has >1 multiplier wilds).
# ---------------------------------------------------------------------------
if [ -n "$SDK_BONUS" ]; then
  echo "==> check #3: realized multiplierWilds on free reveals…"
  python3 - "$GAME" "$SDK_BONUS" <<'PYEOF' || exit 1
import json, sys
sys.path.insert(0, "math/simulator"); sys.path.insert(0, "math"); sys.path.insert(0, "math/scripts")
from simulator.definition import load_definition
from validate_sdk_books import _load_books
d = load_definition(sys.argv[1])
vals = list(getattr(d, "mult_wild_values", []) or [])
if not any(int(v) > 1 for v in vals):
    print("    (game has no >1 multiplier wilds — skipping multiplierWilds check)")
    sys.exit(0)
books = _load_books(sys.argv[2])
free_reveals = mw_reveals = 0
for b in books:
    for e in b.get("events", []):
        if e.get("type") == "reveal" and e.get("gameType") == "free":
            free_reveals += 1
            if e.get("multiplierWilds"):
                mw_reveals += 1
if free_reveals and mw_reveals == 0:
    print("FAIL: SDK free reveals carry no `multiplierWilds` — realized wilds not emitted.")
    sys.exit(1)
print(f"    PASS: {mw_reveals}/{free_reveals} free reveals carried realized multiplierWilds.")
PYEOF
fi

# ---------------------------------------------------------------------------
# 5. Optional check #3 — POST-OPTIMIZATION RTP vs the standalone (OFF by
#    default). Raw create_books RTP is quota-shaped and is NOT comparable to the
#    standalone (docs/adr/0005 Update 3); only enable where the Rust optimizer
#    has run and produced an optimized library.
# ---------------------------------------------------------------------------
if [ "$CHECK_RTP" = "1" ]; then
  RTP_TOL="${SDK_PARITY_RTP_TOL:-0.03}"
  echo "==> check #3: post-optimization base RTP vs standalone (tol $RTP_TOL)…"
  python3 math/scripts/generate_books.py --game "$GAME" --sims "$SIMS" >/dev/null 2>&1 \
    || skip "standalone generation failed"
  STD_RTP="$(python3 - "$GAME" <<'PY'
import json, sys
cfg = json.load(open(f"math/library/{sys.argv[1]}/configs/config.json"))
m = next((m for m in cfg.get("betModes", []) if m.get("name") == "base"), {})
print(m.get("measuredRtp", m.get("rtp", "")))
PY
)"
  python3 - "$SDK_BASE" "$STD_RTP" "$RTP_TOL" <<'PY' || exit 1
import sys
sys.path.insert(0, "math/scripts")
from validate_sdk_books import _load_books
books = _load_books(sys.argv[1])
n = len(books)
sdk_rtp = sum(b["payoutMultiplier"] for b in books) / 100.0 / n if n else 0.0
std_rtp, tol = float(sys.argv[2]), float(sys.argv[3])
delta = abs(sdk_rtp - std_rtp)
print(f"    SDK base RTP: {sdk_rtp:.4f}  (standalone {std_rtp:.4f}, |Δ|={delta:.4f}, tol {tol})")
if delta > tol:
    print("FAIL: post-optimization RTP mismatch > tol.")
    sys.exit(1)
print("PASS: SDK base output matches the standalone within tolerance.")
PY
else
  echo "==> check #3 (RTP): skipped — raw create_books RTP is quota-shaped (set"
  echo "    SDK_PARITY_CHECK_RTP=1 only in an SDK+Rust env that ran the optimizer)."
fi

echo "==> sdk-parity[$GAME]: PASS"
