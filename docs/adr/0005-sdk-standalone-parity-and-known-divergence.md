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

## Update 3 — the port landed; and why raw SDK RTP isn't a parity oracle

The NovaForged module has now been **ported to the real SDK API and runs
end-to-end** (`create_books`). The six modules were rewritten against the actual
surface (`Config`/`BetMode`/`Distribution`, `GeneralGameState`, static
`Lines.get_lines`/`record_lines_wins`/`emit_linewin_events`,
`src.events.events.*`, the Symbol-attribute model). Two file-level fixes were
needed to share the canonical inputs:

- **Paytable ÷ paylines.** The shared paytable is in _total-bet_ units (the
  standalone divides each line win by `num_paylines`, see `mechanics.py`); the
  SDK pays per line and sums, so `game_config` divides the paytable by 20 to
  land on the same per-line payout.
- **Reel-header strip.** The shared reel CSVs carry an `R1..R5` column header
  the SDK's `read_reels_csv` would ingest as a symbol (`'R4' is not
registered`); `game_config` overrides the reader to drop it.

All four NovaForged free-game mechanics are realized natively in the SDK and
verified against a book set: realized multiplier wilds (native Symbol
`multiplier` attribute, summed per line via `multiplier_method="symbol"`) in
5000/5000 bonus books; expanding wilds on the middle reels; the escalating
global-multiplier ladder; and the free-game win scale applied to the whole spin
win — matching `spin_win = (lines + scatter) * global_mult * win_scale`.

One forcing detail worth recording: a `wincap` forced distribution needs a
high-volatility WCAP reel (as `0_0_lines` ships) to be reachable; without it,
forcing a 5000x book loops forever. The wincap distributions are therefore
**omitted** from the bet modes for now (noted in `game_config`) — the natural
wincap still clamps; only the _forced_ wincap quota is deferred until a WCAP
reel is added.

### The real finding: raw `create_books` RTP is quota-shaped, not natural

The original parity premise (run the SDK, compare its **RTP** to the
standalone's) is **flawed by construction**. The SDK's `create_books` does not
sample a natural population of rounds — it generates books **per forced
distribution**, in the quotas declared on each `BetMode` (NovaForged base:
`freegame` 0.1, `"0"` 0.4, `basegame` 0.5). The raw RTP of that book pile is an
artifact of the forcing quotas, not the game's true return. A direct run here
showed a base "RTP" of **~16x** precisely because 10% of books are forced
free-game triggers worth a great deal each — nowhere near the 0.965 target.

This is **by design**: the books are the _input_ to the SDK's **Rust optimizer**
(`optimization_program`), which solves for the per-book selection weights that
hit the target RTP/volatility. The natural RTP only exists **after
optimization**, in the lookup tables — not in the raw `create_books` output. The
optimizer needs Rust + the math-sdk toolchain unavailable in this environment.

### What the parity gate should actually check (re-scoped, again)

Comparing raw SDK RTP to standalone RTP is a category error. The defensible,
environment-independent parity checks are:

1. **Per-outcome math correctness** — for the _same board + same realized
   multiplier grid_, the SDK line evaluation and the standalone `LinesMechanic`
   pay the same. Unit-testable here without the optimizer; the real guard that
   the two engines agree on the mechanic.
2. **Book contract** — SDK book events map onto the shared `BookEvent` union the
   frontend replays (the next piece of work).
3. **Post-optimization RTP** — only meaningful where the Rust optimizer runs;
   belongs in the SDK-capable submission environment, gated by the submission
   checklist, **not** in the raw-`create_books` comparison.

So `check-sdk-parity.sh`'s "compare RTP" step is a **post-optimization** check
that only runs in an SDK+Rust environment; the runnable-everywhere guards are the
per-outcome math equivalence and the book contract. The standalone remains the
fast validated mirror and the source of the pre-submission RTP number; the SDK's
optimizer produces the certified PAR.

## Update 4 — payout quantization (RGS upload rule)

Running the SDK's own upload verifier (`utils/rgs_verification.py`) surfaced a
hard conformance rule the port initially violated: `verify_lookup_format`
asserts every lookup-table payout is a **non-negative integer, divisible by 10,
with a minimum non-zero value of 10** (book units = multiplier × 100, so payouts
are quantized to **0.1x** / 10-cent increments). Our shared paytable, divided to
per-line units (÷ `num_paylines`), produces sub-cent payouts (e.g. `0.73x →
73`), so 181/400 base lookup rows failed the rule.

Fix: `game_override.update_final_win` is overridden to **round the round payout
to the nearest 0.1x** (half-up), keeping the base/free split summing to the
quantized total. This is the single, certified place a payout is quantized — the
per-event amounts stay at full precision; only the authoritative
`payoutMultiplier` / lookup-table payout is snapped to the grid. After the fix
the SDK's `verify_lookup_format` passes for both modes (0 violations over 25k
books), and `compare_payout_values` confirms the book payouts equal the
lookup-table payouts. Guarded by `validate_sdk_books.py`, the
`test_sdk_book_contract.py` quantization test, and a lookup-table check in
`check-sdk-parity.sh`.

### `execute_all_tests` passes — including the bonus verification sidecar

Running the SDK's full uploader verifier (`execute_all_tests`) initially passed
**base** but failed **bonus** on the fast-path `payout_hash`. Root cause: the SDK
initialises `self._payout_ints` only in `__init__` and never clears it between bet
modes, so when `create_books` runs base (20k) then bonus (5k) on the same
gamestate, the bonus mode's verification sidecar accumulates **both** modes'
payouts (25k vs 5k) and its hash no longer matches the published lookup table.
This is an upstream SDK bug, not a payout-value problem (quantization changes
values, not the sidecar count).

Fix (from our side, since `math/engine/` is vendored/gitignored):
`gamestate.GameState.run_sims` resets `self._payout_ints = []` before delegating
to the SDK — each `run_sims` call writes its own per-thread sidecar, so each
sidecar now contains only its own run's payouts. After this, `execute_all_tests`
passes for **both** modes (fast path: SHA-256 OK, payout hash OK, entries
20000/5000). `check-sdk-parity.sh` now runs the SDK's own `execute_all_tests` as
its check #1 — the authoritative Stake RGS verification — over compressed publish
books.

What remains genuinely environment-bound: the **Rust optimizer** run that
produces the certified selection weights and the post-optimization RTP. That
needs the SDK+Rust submission environment; this harness validates everything up
to (but not including) the optimizer.

## Update 5 — all three games ported

The remaining two games are now ported to the real SDK with the same treatment
as NovaForged:

| Game              | Mechanic | SDK calc                   | Win event     |
| ----------------- | -------- | -------------------------- | ------------- |
| `novaforged`      | lines    | `Lines.get_lines`          | `lineWins`    |
| `cosmicways`      | all-ways | `Ways.get_ways_data`       | `wayWins`     |
| `stellarclusters` | cluster  | `Cluster.get_cluster_data` | `clusterWins` |

Cosmic Ways and Stellar Clusters both disable multiplier wilds
(`multiplierWilds.values == [1]`) and expanding wilds, so their free game is
mechanic + scatter pays scaled by the win scale (flat ladder). The shared layer
is now generic: the base-game win-event type comes from
`config.contract_win_event`, and the gamestate guards expanding wilds (no-op when
disabled), the ladder (no-op when flat), and retriggers (skipped when a game has
no free-game trigger table). All the per-game certification mechanics —
0.1x payout quantization, the per-mode payout-sidecar reset, the contract-event
emission — are shared.

Verified for all three: `check-sdk-parity.sh <game>` passes — the SDK's own
`execute_all_tests` (verify_lookup_format + book/LUT payout-hash + SHA-256) green
for both modes, and every book conforms to the `BookEvent` contract. The
hermetic `test_event_contract.py` covers each game's event factories in CI
(no SDK).

## Update 6 — the Rust optimizer runs; certified RTP solved to target

Updates 3–5 called the Rust optimizer "environment-bound." That's now
**superseded** — given a Rust toolchain and **Python 3.12** (the SDK's required
interpreter; 3.11 runs `create_books` but not the full path), the optimizer runs
end to end here once its config is ported to the real API.

Two fixes made it work:

1. **`game_optimization.py`** rewritten against the real `optimization_program`
   API (`ConstructConditions`/`ConstructScaling`/`ConstructParameters`/
   `ConstructFenceBias` + `verify_optimization_input`) — the previous module
   imported a non-existent `OptimizationSetup` from `optimization_config`. The
   per-mode RTP allocation across criteria (base: wincap/0/freegame/basegame;
   bonus: wincap/freegame) sums to the target; NovaForged splits base-heavy, the
   ways/cluster games free-game-heavy.
2. **`run.py` ordering** — `OptimizationSetup(config)` must run **before** the
   first `generate_configs`, because it populates `config.opt_params`, which
   `generate_configs` writes into `math_config.json` (the optimizer reads its
   `bet_modes`/`fences`/`bias` from there). The old order left those empty → the
   Rust binary panicked with "betmode index not found."

Result — all three games' certified libraries hit the target exactly (100k base
/ 40k bonus sims):

| Game              | base RTP | bonus RTP |
| ----------------- | -------- | --------- |
| `novaforged`      | 0.9650   | 0.9650    |
| `cosmicways`      | 0.9650   | 0.9650    |
| `stellarclusters` | 0.9650   | 0.9650    |

`scripts/run-certification.sh <game>` runs the whole certified pipeline in one
command (fail-soft if Python 3.12 / Rust / the SDK are absent); the prerequisites
and the proven result are documented in `docs/sdk-certification-runbook.md`. The
post-optimization RTP is no longer a deferred unknown.
