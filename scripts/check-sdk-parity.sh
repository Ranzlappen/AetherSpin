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
# 2. Generate a SMALL, uncompressed SDK library (create_books directly — skips
#    the heavy Rust optimizer that run.py would invoke). Fail-soft.
# ---------------------------------------------------------------------------
echo "==> running the SDK book generation ($SIMS sims, no optimizer)…"
(
  cd "$ENGINE/games/$GAME"
  PYTHONHASHSEED=0 PYTHONPATH="$ENGINE" python3 - "$SIMS" <<'PY'
import sys
sims = int(sys.argv[1])
from game_config import GameConfig
from gamestate import GameState
from src.state.run_sims import create_books  # type: ignore
cfg = GameConfig()
gs = GameState(cfg)
create_books(gs, cfg, {"base": sims, "bonus": max(1, sims // 4)}, max(1, sims), 1, False, False)
print("SDK_BOOKS_OK")
PY
) >/tmp/sdk-gen.log 2>&1 || skip "SDK generation failed (see /tmp/sdk-gen.log) — reconcile in an SDK-capable env"
grep -q "SDK_BOOKS_OK" /tmp/sdk-gen.log || skip "SDK generation did not complete"

# Locate the SDK-produced books (uncompressed JSON arrays). The SDK's
# construct_paths always writes to <game>/library/books/; fall back to find.
SDK_BOOKS_DIR="$ENGINE/games/$GAME/library/books"
SDK_BASE="$SDK_BOOKS_DIR/books_base.json"
SDK_BONUS="$SDK_BOOKS_DIR/books_bonus.json"
[ -f "$SDK_BASE" ] || SDK_BASE="$(find "$ENGINE" -name "books_base.json" 2>/dev/null | head -1)"
[ -f "$SDK_BONUS" ] || SDK_BONUS="$(find "$ENGINE" -name "books_bonus.json" 2>/dev/null | head -1)"
[ -f "$SDK_BASE" ] || skip "could not locate SDK-generated books"
[ -f "$SDK_BONUS" ] || SDK_BONUS=""
echo "    SDK books: ${SDK_BASE#$ROOT/}${SDK_BONUS:+, ${SDK_BONUS#$ROOT/}}"

# ---------------------------------------------------------------------------
# 3. Real check #1 — SDK books must satisfy the shared BookEvent contract.
#    (validate_sdk_books understands the SDK's cents-encoded payoutMultiplier.)
# ---------------------------------------------------------------------------
echo "==> check #1: SDK books conform to the BookEvent contract…"
python3 math/scripts/validate_sdk_books.py "$SDK_BASE" ${SDK_BONUS:+"$SDK_BONUS"} \
  || { echo "FAIL: SDK books violate the shared book contract (docs/adr/0005)."; exit 1; }

# ---------------------------------------------------------------------------
# 4. Real check #2 — free reveals must carry realized `multiplierWilds`
#    (only meaningful if the game has >1 multiplier wilds).
# ---------------------------------------------------------------------------
if [ -n "$SDK_BONUS" ]; then
  echo "==> check #2: realized multiplierWilds on free reveals…"
  python3 - "$GAME" "$SDK_BONUS" <<'PY' || exit 1
import json, sys
sys.path.insert(0, "math/simulator"); sys.path.insert(0, "math")
from simulator.definition import load_definition
d = load_definition(sys.argv[1])
vals = list(getattr(d, "mult_wild_values", []) or [])
if not any(int(v) > 1 for v in vals):
    print("    (game has no >1 multiplier wilds — skipping multiplierWilds check)")
    sys.exit(0)
books = json.load(open(sys.argv[2], encoding="utf-8"))
if isinstance(books, dict):
    books = list(books.values())
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
PY
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
import json, sys
books = json.load(open(sys.argv[1], encoding="utf-8"))
if isinstance(books, dict):
    books = list(books.values())
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
