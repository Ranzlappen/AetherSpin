# SDK ↔ standalone parity runbook

How to run the **final certification gate** — the one step that needs an
SDK-capable environment and therefore can't run in this repo's normal CI.

It answers one question: **does the certified math-sdk produce the same money the
standalone engine validated?** Everything else (RTP gates, book validation,
golden parity, the event contract) already runs on every push. This is the last
mile, and after the multiplier-wild reconciliation ([ADR 0005](adr/0005-sdk-standalone-parity-and-known-divergence.md))
it should now pass.

## When to run it

- Before submitting any game to Stake Engine certification.
- After changing anything in `math/games/<id>/*.py`, a game's reels/paytable, or
  the standalone engine's win logic.
- Nightly, automatically, via `.github/workflows/sdk-parity.yml` (fail-soft —
  it SKIPs where the SDK can't be fetched).

## Prerequisites

| Need                                                 | Why                                            | Notes                                                                                |
| ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `git` + network to `github.com/StakeEngine/math-sdk` | clone the SDK into `math/engine/` (gitignored) | the only hard external dependency                                                    |
| Python 3.11                                          | run the SDK book generation                    | same version CI uses                                                                 |
| The SDK's `requirements.txt`                         | SDK runtime deps                               | installed for you by the driver                                                      |
| ~~Rust / `cargo`~~                                   | **not required**                               | the parity check generates books via `create_books` and **skips the Rust optimizer** |

> If you're on a network-restricted box (like this repo's default CI/sandbox),
> the clone will fail and the gate SKIPs — that's expected and safe. Run it
> somewhere with access to GitHub.

## Quick start

```bash
# All games. Prints a PASS/SKIP/FAIL summary; exits non-zero on any real FAIL.
bash scripts/run-sdk-parity.sh

# Expect every game to actually execute (treat SKIP as failure):
bash scripts/run-sdk-parity.sh --strict

# A single game:
bash scripts/run-sdk-parity.sh novaforged
```

The driver fetches + wires the SDK (`scripts/setup-math.sh`), installs its Python
deps, then runs `scripts/check-sdk-parity.sh` for each game and summarises.

## What it checks

For each game, against a freshly generated SDK library and the standalone
reference (`scripts/check-sdk-parity.sh`):

1. **Book contract** — every SDK book satisfies the shared
   `bookcontract`/`book.schema.json` (event vocabulary, ordering, `payoutMultiplier ≤ wincap`).
2. **Base RTP** — SDK base RTP within tolerance of the standalone's.
3. **Bonus / free-game RTP** — SDK bonus RTP within tolerance of the standalone's.
   _This is where multiplier wilds live;_ check #2 alone can't see them.
4. **`multiplierWilds` emission** — if the game has >1 multiplier wilds, SDK
   **free reveals must carry realized `multiplierWilds`** (a regression to the old
   averaged approach emits none → FAIL). Auto-skips for games without them.

## Interpreting the result

| Outcome                                          | Meaning                                                                             | Action                                                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PASS**                                         | SDK output matches the standalone within tolerance, and realized wilds are emitted. | Proceed — this is the green light for `scripts/package-for-stake.sh`.                                                                                                                                            |
| **SKIP**                                         | The SDK couldn't be fetched/built in this environment.                              | Not a failure, but the gate didn't run. Move to an environment with GitHub access; use `--strict` to make SKIP an error.                                                                                         |
| **FAIL: book contract**                          | SDK emitted an event shape the contract rejects.                                    | Diff the SDK `game_events.py` against `shared/src/types/events.ts`; an event type or field drifted.                                                                                                              |
| **FAIL: base RTP**                               | Base-game math diverged.                                                            | Compare `game_calculations`/`game_executables` line/scatter logic to `simulator/engine.py`.                                                                                                                      |
| **FAIL: bonus RTP** or **FAIL: multiplierWilds** | The free-game reconciliation regressed (ADR 0005).                                  | Re-check `sample_multiplier_grid` + the summed per-cell wild logic in `math/games/<id>/game_calculations.py`; confirm `reveal_event` emits `multiplierWilds`. `test_sdk_multiplier_wilds.py` should also be red. |

## Tuning

Tighter checks for a real certification run (more sims = less variance):

```bash
SDK_PARITY_SIMS=200000 \
SDK_PARITY_RTP_TOL=0.02 \
SDK_PARITY_BONUS_TOL=0.04 \
bash scripts/run-sdk-parity.sh --strict
```

- `SDK_PARITY_SIMS` (default 50000) — books generated per mode.
- `SDK_PARITY_RTP_TOL` (default 0.03) — base RTP tolerance.
- `SDK_PARITY_BONUS_TOL` (default 0.08) — bonus RTP tolerance (looser because the
  free game is higher-variance; tighten it as you raise `SDK_PARITY_SIMS`).

## Per-game expectations

| Game              | Mechanic | Multiplier wilds     | `multiplierWilds` check                   |
| ----------------- | -------- | -------------------- | ----------------------------------------- |
| `novaforged`      | lines    | `[2,3,5]@[60,30,10]` | **active** — free reveals must carry them |
| `cosmicways`      | ways     | disabled (value 1)   | auto-skips                                |
| `stellarclusters` | cluster  | disabled (value 1)   | auto-skips                                |

## After a green run

A passing `--strict` run on the game you're submitting means "certified == validated."
At that point you can:

1. Remove the "known divergence" section from [ADR 0005](adr/0005-sdk-standalone-parity-and-known-divergence.md)
   and promote `sdk-parity.yml` toward a required check.
2. Tick **SDK ↔ standalone parity verified** in
   [the submission checklist](stake-engine-submission-checklist.md).
3. Build the certified bundle: `bash scripts/package-for-stake.sh <game>`.

## Manual steps (what the driver does, for debugging)

```bash
# 1. Fetch + wire the SDK (clones into math/engine/, symlinks games + shared defs)
bash scripts/setup-math.sh

# 2. Install the SDK's Python deps
pip install -r math/engine/requirements.txt

# 3. Run the gate for one game (fail-soft: SKIPs if the SDK is unavailable)
bash scripts/check-sdk-parity.sh novaforged

# 4. (Optional) the full SDK pipeline incl. the Rust optimizer + reports
cd math/engine && python games/novaforged/run.py
```
