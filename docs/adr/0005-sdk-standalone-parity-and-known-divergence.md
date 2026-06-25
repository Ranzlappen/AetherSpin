# ADR 0005 — SDK ↔ standalone math parity (and a known divergence)

Status: Accepted · Supersedes nothing · Relates to ADR 0002 (two math paths)

## Context

We run two math implementations (ADR 0002): the **standalone** simulator
(`math/simulator/`, stdlib-only, exercised by CI) and the **official
StakeEngine math-sdk** modules (`math/games/<id>/`), which produce the **actually
certified** books. CI today verifies:

- standalone ↔ frontend: the golden-book parity corpus (`test_parity.py` +
  `parity.test.ts`) and the standalone book contract;
- the SDK **event factories** (`game_events.py`) against the shared `BookEvent`
  contract (`test_event_contract*.py`) and the SDK modules' **syntax**
  (`py_compile`).

What CI does **not** do is _execute_ the SDK pipeline — the math-sdk is not
vendored (it's cloned on demand by `scripts/setup-math.sh` into the gitignored
`math/engine/`, and needs Rust + heavy deps). So "what you certify" (SDK output)
is not byte-or-stat compared against "what you validated" (standalone output).
This is audit issue #4 ("two unverified sources of truth").

## Known divergence (must be reconciled before relying on SDK free-game RTP)

The two paths intentionally agree on the **event vocabulary** but currently
**diverge on free-game multiplier wilds**:

- **Standalone** (`simulator/engine.py` + `mechanics.py`) samples a **realized**
  multiplier per wild cell, emits `multiplierWilds:[{reel,row,value}]` on the
  free-spin `reveal`, and sums the participating cells' realized values per win
  (audit A2). This is what the frontend renders.
- **SDK** (`game_calculations.py`) applies a single **averaged**
  `expected_wild_multiplier` (the weighted mean of the multiplier values) to
  every wild win, and the SDK `reveal_event` does not emit `multiplierWilds`.

Consequence: for **NovaForged** (multiplier wilds `[2,3,5]@[60,30,10]`), the SDK
and standalone free-game payouts differ for the same board, and the certified
books wouldn't carry the per-cell `multiplierWilds` the frontend expects.
**Cosmic Ways is unaffected** — its multiplier wilds are disabled (value `1`), so
`expected_wild_multiplier == 1 ==` the realized value.

## Decision

1. **Treat the SDK path as authoritative for certification, the standalone as the
   fast/validated mirror — and prove they agree before submission**, not just at
   the contract level. The reconciliation (porting realized multiplier wilds into
   the SDK `game_calculations` / `game_executables` / `game_events`, mirroring the
   standalone) is deliberately **deferred to an SDK-capable environment**: it
   changes certified, money-handling code and must be verified against a real SDK
   run, never landed blind.
2. **Ship the parity gate now, fail-soft.** `scripts/check-sdk-parity.sh` runs the
   SDK pipeline where it's available and compares its output — book contract and
   base RTP — to the standalone; `.github/workflows/sdk-parity.yml` runs it on
   demand and nightly, and **skips cleanly** where the SDK can't be fetched (e.g.
   network-restricted CI). It is not a required PR check.
3. **Gate submission on it.** `docs/stake-engine-submission-checklist.md` now
   requires a green `check-sdk-parity.sh` for the game being submitted.

## Consequences

- The divergence is now **explicit and tracked**, not silent. Anyone wiring up the
  SDK environment runs one script to see whether the certified books match.
- Until reconciled, **do not rely on the SDK's NovaForged free-game RTP** as
  equal to the standalone's; the standalone RTP gate remains the validated number,
  and the certified PAR comes from the SDK's own optimizer run.
- When the reconciliation lands (in an SDK-capable env), this ADR's "known
  divergence" section should be removed and the parity gate promoted toward
  required.
