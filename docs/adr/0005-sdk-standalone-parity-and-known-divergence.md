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

### Update — reconciled in code (pending a real SDK run)

The reconciliation has now **landed in the SDK module** (`math/games/novaforged/`):
`game_calculations.sample_multiplier_grid` realizes a multiplier per wild cell,
`reveal_event` emits `multiplierWilds`, and line evaluation sums the participating
wild cells — mirroring `simulator/engine.py`/`mechanics.py`. The averaged
`expected_wild_multiplier` is gone. Because the certified SDK can't run in this
environment, the change is proven **here** by `test_sdk_multiplier_wilds.py`,
which runs the reconciled SDK `get_line_wins` and the validated standalone
`LinesMechanic` over thousands of random free-game boards on the **same** realized
grid and asserts identical wins. The remaining step — a real SDK run confirming
the end-to-end book/RTP parity — is what the (now free-game-aware) parity gate
performs where the SDK is available.

## Decision

1. **Treat the SDK path as authoritative for certification, the standalone as the
   fast/validated mirror — and prove they agree before submission**, not just at
   the contract level. The reconciliation (realized multiplier wilds in the SDK
   `game_calculations` / `game_executables` / `game_events`, mirroring the
   standalone) is now **written and unit-proven against the standalone**
   (`test_sdk_multiplier_wilds.py`); the certified-code change must still be
   **confirmed against a real SDK run** before submission — never trusted blind.
2. **Ship the parity gate now, fail-soft — and make it free-game-aware.**
   `scripts/check-sdk-parity.sh` runs the SDK pipeline where it's available and
   compares its output to the standalone: the book contract, **base RTP**, **bonus
   (free-game) RTP** — where multiplier wilds live — and that free reveals actually
   carry `multiplierWilds`. `.github/workflows/sdk-parity.yml` runs it on demand and
   nightly, and **skips cleanly** where the SDK can't be fetched (e.g.
   network-restricted CI). It is not a required PR check.
3. **Gate submission on it.** `docs/stake-engine-submission-checklist.md` now
   requires a green `check-sdk-parity.sh` for the game being submitted.

## Consequences

- The divergence is now **explicit and tracked**, not silent. Anyone wiring up the
  SDK environment runs one script to see whether the certified books match.
- The code divergence is **closed**; what remains is **verification**. Until a real
  SDK run confirms the free-game parity, the standalone RTP gate remains the
  validated number and the certified PAR comes from the SDK's own optimizer run.
- Once a real SDK run passes the free-game-aware `check-sdk-parity.sh`, this ADR's
  "known divergence" section can be removed and the parity gate promoted toward a
  required check.

## Update 2 — what the first real SDK run revealed

The SDK was finally run against in an SDK-capable session (vendored via a
GitHub **tarball** through the HTTPS proxy — plain `git clone` is allowlist-blocked
here). The result corrects the record: **the `math/games/<id>/*.py` modules were
written against an _assumed_ SDK API and do not execute on the current
`StakeEngine/math-sdk`.** `py_compile` + the pure event-factory contract tests
never caught this because nothing instantiated the SDK classes.

What the run surfaced (novaforged):

- `GameState` can't be instantiated — the SDK's `src/state/state.py` declares an
  abstract `assign_special_sym_function()` the modules don't implement.
- The modules also call methods that **don't exist** on the real bases
  (`create_board_reelstrips`, an instance `get_line_wins`, hand-written
  `game_events` factories appended via `self.book.add_event`). The real SDK uses a
  different surface: `Lines.get_lines(...)` / `record_lines_wins` /
  `emit_linewin_events` (static, on `src.calculations.lines.Lines`), events from
  `src.events.events.*`, and a **Symbol-attribute model** where a board cell is a
  `Symbol` object carrying attributes.

Crucially, **the SDK implements realized multiplier wilds natively**: an
`assign_special_sym_function` maps `"W" → assign_mult_property`, which samples a
per-symbol multiplier from the bet-mode distribution
(`get_current_distribution_conditions()["mult_values"][gametype]`) and stores it
on the symbol. So the _mechanic_ from #49 (realized per-cell wilds, summed per
line) is aligned with how the SDK already works — what's wrong is the **API
surface**, not the math model.

### The real remaining work (re-scoped)

The SDK modules need a **port to the current SDK API**, modeled on the SDK's own
example games (under `math/engine/games/` once vendored):

| AetherSpin game   | Closest SDK example | Notes                                           |
| ----------------- | ------------------- | ----------------------------------------------- |
| `novaforged`      | `0_0_expwilds`      | lines + expanding wilds + multiplier wilds + FS |
| `cosmicways`      | `0_0_ways`          | all-ways                                        |
| `stellarclusters` | `0_0_cluster`       | cluster pays                                    |

The port re-implements `game_config` (real `Config`/`BetMode`/`Distribution`
with `mult_values`/`landing_wilds` conditions), `gamestate` (real run loop:
`Lines.get_lines` → `record_lines_wins` → `emit_linewin_events`),
`game_override` (`assign_special_sym_function`, resets), and `game_events`
(built on `src.events`), parameterized by the shared definition. The
free-game-aware `check-sdk-parity.sh` is the acceptance test (RTP + book contract

- realized wilds). Until that passes, **the standalone + frontend remain the
  validated truth** and the SDK modules are non-functional scaffolding. This is the
  genuine remaining certification work — larger than the "averaged vs realized"
  framing above implied.
