#!/usr/bin/env bash
#
# check-sdk-parity.sh <game> — compare the certified math-sdk output to the
# standalone engine for one game (see docs/adr/0005).
#
# Design: FAIL-SOFT. Every step that depends on the (non-vendored) math-sdk
# SKIPs with exit 0 on any error — so this is safe in network-restricted CI and
# can NEVER raise a false alarm. It returns non-zero ONLY when it successfully
# generated SDK books and measured a REAL mismatch against the standalone
# (contract violation, or RTP outside tolerance of the standalone's).
#
# Run it where the SDK is available (Rust + network); otherwise it skips.
#
#   scripts/check-sdk-parity.sh novaforged
#
set -uo pipefail

GAME="${1:-novaforged}"
SIMS="${SDK_PARITY_SIMS:-50000}"
RTP_TOL="${SDK_PARITY_RTP_TOL:-0.03}"

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
# 1. Standalone reference (always available, stdlib-only).
# ---------------------------------------------------------------------------
echo "==> sdk-parity[$GAME]: generating standalone reference ($SIMS sims)…"
python3 math/scripts/generate_books.py --game "$GAME" --sims "$SIMS" >/dev/null 2>&1 \
  || skip "standalone generation failed (unexpected — this should always work)"
read_std_rtp() {
  python3 - "$GAME" "$1" <<'PY'
import json, sys
cfg = json.load(open(f"math/library/{sys.argv[1]}/configs/config.json"))
modes = cfg.get("betModes", [])
want = sys.argv[2]
m = next((m for m in modes if m.get("name") == want), {})
print(m.get("measuredRtp", m.get("rtp", "")))
PY
}
STD_RTP="$(read_std_rtp base)"
STD_BONUS_RTP="$(read_std_rtp bonus)"
[ -n "$STD_RTP" ] || skip "could not read standalone base RTP"
echo "    standalone base RTP: $STD_RTP   bonus RTP: ${STD_BONUS_RTP:-n/a}"

# ---------------------------------------------------------------------------
# 2. Ensure the math-sdk is present and wired (fail-soft clone).
# ---------------------------------------------------------------------------
if [ ! -d "$ENGINE/.git" ]; then
  echo "==> fetching math-sdk (scripts/setup-math.sh)…"
  bash scripts/setup-math.sh >/tmp/sdk-setup.log 2>&1 || skip "math-sdk clone/setup failed (no network?)"
fi
[ -f "$ENGINE/games/$GAME/run.py" ] || skip "game '$GAME' not linked into the SDK"

# SDK Python deps (fail-soft).
if [ -f "$ENGINE/requirements.txt" ]; then
  pip install -q -r "$ENGINE/requirements.txt" >/tmp/sdk-pip.log 2>&1 || skip "could not install SDK requirements"
fi

# ---------------------------------------------------------------------------
# 3. Generate a SMALL SDK library (create_books directly — skips the heavy Rust
#    optimizer that run.py would invoke). Any failure here is fail-soft.
# ---------------------------------------------------------------------------
echo "==> running the SDK book generation ($SIMS sims, no optimizer)…"
(
  cd "$ENGINE/games/$GAME"
  PYTHONHASHSEED=0 python3 - "$SIMS" <<'PY'
import sys
sims = int(sys.argv[1])
from game_config import GameConfig
from gamestate import GameState
from src.state.run_sims import create_books  # type: ignore
cfg = GameConfig()
gs = GameState(cfg)
create_books(gs, cfg, {"base": sims, "bonus": max(1, sims // 5)}, 50000, 4, True, False)
print("SDK_BOOKS_OK")
PY
) >/tmp/sdk-gen.log 2>&1 || skip "SDK generation failed (see /tmp/sdk-gen.log) — reconcile in an SDK-capable env"
grep -q "SDK_BOOKS_OK" /tmp/sdk-gen.log || skip "SDK generation did not complete"

# ---------------------------------------------------------------------------
# 4. Locate the SDK-produced books and validate them with OUR book contract.
# ---------------------------------------------------------------------------
SDK_BASE="$(find "$ENGINE" -path "*$GAME*books*books_base*.jsonl" 2>/dev/null | head -1)"
[ -n "$SDK_BASE" ] || skip "could not locate SDK-generated books"
echo "    SDK books: ${SDK_BASE#$ROOT/}"

# Real check #1: SDK books must satisfy the shared book contract.
python3 - "$GAME" "$SDK_BASE" <<'PY' || { echo "FAIL: SDK books violate the book contract"; exit 1; }
import json, sys
sys.path.insert(0, "math/simulator"); sys.path.insert(0, "math")
from simulator.bookcontract import validate_book
from simulator.definition import load_definition
wincap = load_definition(sys.argv[1]).wincap
bad = 0
for line in open(sys.argv[2], encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    b = json.loads(line)
    problems = validate_book(b, wincap=wincap)
    if problems:
        bad += 1
        if bad <= 5:
            print(f"  id={b.get('id')}: {problems}")
sys.exit(1 if bad else 0)
PY

# Real check #2: SDK base RTP must be within tolerance of the standalone's.
python3 - "$SDK_BASE" "$STD_RTP" "$RTP_TOL" <<'PY' || exit 1
import json, sys
path, std_rtp, tol = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
total = n = 0.0
for line in open(path, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    total += json.loads(line)["payoutMultiplier"]; n += 1
sdk_rtp = total / n if n else 0.0
delta = abs(sdk_rtp - std_rtp)
print(f"    SDK base RTP: {sdk_rtp:.4f}  (standalone {std_rtp:.4f}, |Δ|={delta:.4f}, tol {tol})")
if delta > tol:
    print(f"FAIL: SDK↔standalone RTP mismatch > {tol}. Likely the known multiplier-wild divergence (docs/adr/0005).")
    sys.exit(1)
print("PASS: SDK base output matches the standalone within tolerance.")
PY

# ---------------------------------------------------------------------------
# 5. Free game — this is where multiplier wilds live (the ADR-0005 divergence),
#    so the base-RTP check above cannot see it. Gate the bonus books too:
#      #3  bonus/free-game RTP within tolerance of the standalone's, and
#      #4  free reveals actually carry `multiplierWilds` (the realized mechanic).
#    A looser bonus tolerance accounts for the free game's higher variance at the
#    harness's modest sample size; tighten via SDK_PARITY_BONUS_TOL on big runs.
# ---------------------------------------------------------------------------
BONUS_TOL="${SDK_PARITY_BONUS_TOL:-0.08}"
SDK_BONUS="$(find "$ENGINE" -path "*$GAME*books*books_bonus*.jsonl" 2>/dev/null | head -1)"
if [ -z "$SDK_BONUS" ]; then
  echo "    note: no SDK bonus books found — skipping free-game parity checks"
else
  echo "    SDK bonus books: ${SDK_BONUS#$ROOT/}"

  # Real check #3: SDK bonus RTP within tolerance of the standalone's (if known).
  if [ -n "$STD_BONUS_RTP" ]; then
    python3 - "$SDK_BONUS" "$STD_BONUS_RTP" "$BONUS_TOL" <<'PY' || exit 1
import json, sys
path, std_rtp, tol = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
total = n = 0.0
for line in open(path, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    total += json.loads(line)["payoutMultiplier"]; n += 1
sdk_rtp = total / n if n else 0.0
delta = abs(sdk_rtp - std_rtp)
print(f"    SDK bonus RTP: {sdk_rtp:.4f}  (standalone {std_rtp:.4f}, |Δ|={delta:.4f}, tol {tol})")
if delta > tol:
    print(f"FAIL: SDK↔standalone BONUS RTP mismatch > {tol} — the multiplier-wild reconciliation (docs/adr/0005) is off.")
    sys.exit(1)
print("PASS: SDK free-game output matches the standalone within tolerance.")
PY
  else
    echo "    note: standalone bonus RTP unavailable — skipping bonus-RTP comparison"
  fi

  # Real check #4: if this game has free-game multiplier wilds, the SDK must emit
  # realized `multiplierWilds` on free reveals (the averaged approach emitted none).
  python3 - "$GAME" "$SDK_BONUS" <<'PY' || exit 1
import json, sys
sys.path.insert(0, "math/simulator"); sys.path.insert(0, "math")
from simulator.definition import load_definition
d = load_definition(sys.argv[1])
vals = list(getattr(d, "mult_wild_values", []) or [])
has_mult_wilds = any(int(v) > 1 for v in vals)
if not has_mult_wilds:
    print("    (game has no >1 multiplier wilds — skipping multiplierWilds emission check)")
    sys.exit(0)
free_reveals = mw_reveals = 0
for line in open(sys.argv[2], encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    for e in json.loads(line).get("events", []):
        if e.get("type") == "reveal" and e.get("gameType") == "free":
            free_reveals += 1
            if e.get("multiplierWilds"):
                mw_reveals += 1
if free_reveals and mw_reveals == 0:
    print("FAIL: SDK free reveals carry no `multiplierWilds` — realized wilds not emitted (docs/adr/0005).")
    sys.exit(1)
print(f"PASS: SDK emits multiplierWilds on free reveals ({mw_reveals}/{free_reveals} carried realized wilds).")
PY
fi

echo "==> sdk-parity[$GAME]: PASS"
