#!/usr/bin/env bash
#
# run-sdk-parity.sh [--strict] [game ...] — one-command driver for the
# SDK ↔ standalone parity gate (see docs/sdk-parity-runbook.md, docs/adr/0005).
#
# This is the "I actually have an SDK-capable box" entry point. Unlike
# scripts/check-sdk-parity.sh (which is fail-soft and per-game so it never breaks
# network-restricted CI), this wrapper:
#   * surfaces setup failures loudly (no silent SKIP on a broken clone),
#   * fetches + wires the math-sdk once (scripts/setup-math.sh),
#   * installs the SDK's Python deps,
#   * runs every game (or the ones you name), and
#   * prints a PASS / SKIP / FAIL summary, exiting non-zero on any FAIL
#     (and on any SKIP when --strict is given — use that when you expect the
#     gate to really run and want setup gaps treated as errors).
#
# Prerequisites: git, a network path to github.com/StakeEngine/math-sdk, and
# Python 3.11 + the SDK requirements. The Rust optimizer is NOT needed — the
# parity check generates books via create_books and skips the optimizer.
#
#   bash scripts/run-sdk-parity.sh            # all games, SKIP is tolerated
#   bash scripts/run-sdk-parity.sh --strict   # all games, SKIP counts as failure
#   bash scripts/run-sdk-parity.sh novaforged # a single game
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

STRICT=0
GAMES=()
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    -h | --help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "unknown flag: $arg (try --help)" >&2
      exit 2
      ;;
    *) GAMES+=("$arg") ;;
  esac
done

# Default to every shared game that has a definition (skip the bare template).
if [ "${#GAMES[@]}" -eq 0 ]; then
  for d in shared/games/*/; do
    g="$(basename "$d")"
    [ "$g" = "template" ] && continue
    [ -f "shared/games/$g/game-definition.json" ] && GAMES+=("$g")
  done
fi

# --- Preflight ------------------------------------------------------------
missing=0
for tool in git python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: '$tool' is required but not on PATH." >&2; missing=1; }
done
[ "$missing" -eq 0 ] || exit 2
if ! command -v cargo >/dev/null 2>&1; then
  echo "note: Rust/cargo not found — that's fine, the parity check bypasses the optimizer."
fi

# --- Fetch + wire the math-sdk (loud failures) ----------------------------
echo "==> ensuring the math-sdk is present and wired (scripts/setup-math.sh)…"
if ! bash scripts/setup-math.sh; then
  echo "" >&2
  echo "ERROR: math-sdk setup failed (clone/network?). See the message above; this" >&2
  echo "       environment may not have access to github.com/StakeEngine/math-sdk." >&2
  exit 1
fi

if [ -f math/engine/requirements.txt ]; then
  echo "==> installing the SDK's Python requirements…"
  if ! pip install -q -r math/engine/requirements.txt; then
    echo "ERROR: could not install math/engine/requirements.txt" >&2
    exit 1
  fi
fi

# --- Run the gate per game ------------------------------------------------
declare -a NAMES=() STATUSES=()
overall_fail=0
overall_skip=0
for g in "${GAMES[@]}"; do
  echo ""
  echo "::group::sdk-parity $g"
  out="$(bash scripts/check-sdk-parity.sh "$g" 2>&1)"
  rc=$?
  echo "$out"
  echo "::endgroup::"
  if [ "$rc" -ne 0 ]; then
    status="FAIL"
    overall_fail=1
  elif printf '%s\n' "$out" | grep -q "SKIP (sdk-parity"; then
    status="SKIP"
    overall_skip=1
  else
    status="PASS"
  fi
  NAMES+=("$g")
  STATUSES+=("$status")
done

# --- Summary --------------------------------------------------------------
echo ""
echo "================ SDK ↔ standalone parity summary ================"
for i in "${!NAMES[@]}"; do
  printf '  %-20s %s\n' "${NAMES[$i]}" "${STATUSES[$i]}"
done
echo "================================================================"

if [ "$overall_fail" -ne 0 ]; then
  echo "RESULT: FAIL — at least one game's SDK output diverged from the standalone."
  echo "        See docs/sdk-parity-runbook.md for how to interpret each failure."
  exit 1
fi
if [ "$STRICT" -eq 1 ] && [ "$overall_skip" -ne 0 ]; then
  echo "RESULT: SKIP treated as failure (--strict) — the SDK pipeline did not run."
  echo "        Fix the setup gap reported above and re-run."
  exit 1
fi
if [ "$overall_skip" -ne 0 ]; then
  echo "RESULT: PASS where it ran, but some games SKIPPED (SDK unavailable for them)."
  echo "        Run with --strict once you expect every game to execute."
  exit 0
fi
echo "RESULT: PASS — every game's certified SDK output matches the standalone."
exit 0
