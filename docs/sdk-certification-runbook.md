# SDK certification runbook (the Rust optimizer)

How to produce a game's **certified** math library — the final, optimized lookup
tables whose RTP is solved to the target by the official math-sdk's Rust
optimizer. This is the last step before packaging for Stake Engine, and the only
one that needs the SDK's heavier toolchain.

One command:

```bash
scripts/run-certification.sh <game>
# e.g. scripts/run-certification.sh novaforged
```

It runs the full pipeline — `OptimizationSetup` → `create_books` →
`generate_configs` → **Rust optimizer** → `generate_configs` → `execute_all_tests`
— and prints the post-optimization RTP. Output lands in
`math/engine/games/<game>/library/` (`publish_files/` holds the certified books +
optimized lookup tables). Then package:

```bash
bash scripts/package-for-stake.sh <game>
```

## Prerequisites

| Need                         | Why                                                     | Notes                                                    |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **Python 3.12**              | the math-sdk uses 3.12-only syntax (`get_file_hash.py`) | `python3.11` runs `create_books` but not the full path   |
| **Rust toolchain** (`cargo`) | the optimizer (`optimization_program`) is a Rust binary | compiled on first run (`cargo build --release`)          |
| math-sdk vendored            | `scripts/setup-math.sh` clones it into `math/engine/`   | gitignored; the script fetches it if absent              |
| SDK deps under 3.12          | `numpy`, `zstandard`, `python-dotenv`                   | the script installs them (`pip --break-system-packages`) |

`run-certification.sh` checks each and **SKIPs cleanly** (exit 0) with guidance
if any is missing, so it's safe to call in environments that can't run it.

## What "optimization" does

`create_books` does **not** produce a natural RTP — it generates books _per
forced distribution_ (win-cap / free-game / zero / base) in declared quotas, so
its raw RTP is quota-shaped (e.g. NovaForged base reads ~16–22x). Those books are
the _input_ to the optimizer, which solves for the per-book **selection weights**
that make the final library hit the target RTP and volatility. The certified RTP
only exists _after_ this step, in the optimized lookup tables.

The per-game optimization targets live in `math/games/<id>/game_optimization.py`
(`OptimizationSetup`): an RTP allocation across criteria (must sum to the target),
win-range scaling, and run parameters. The criteria mirror the bet-mode
distributions: base = `wincap`/`0`/`freegame`/`basegame`, bonus =
`wincap`/`freegame`. NovaForged splits base RTP base-heavy; Cosmic Ways / Stellar
Clusters split it free-game-heavy (their base ways/cluster wins are small while
the free game carries a high win-scale).

## Verified result

Run in an SDK-capable environment (Python 3.12 + Rust), the optimizer converges
to the target exactly. For NovaForged (100k base / 40k bonus sims, ~3 min):

```
[base]  POST-OPT RTP = 0.9650  (target 0.965)
[bonus] POST-OPT RTP = 0.9650  (target 0.965, cost 100x)
```

Sim counts default to production (`1e6` base / `2e5` bonus, set in each game's
`run.py`); override for a quick pass with `SDK_BASE_SIMS` / `SDK_BONUS_SIMS`.

## Where this fits

1. **Dev / CI** — the standalone engine + `check-sdk-parity.sh` (book contract,
   RGS `execute_all_tests`, payout quantization) run on every push and prove the
   math is structurally correct and RGS-conformant.
2. **Certification** (this runbook) — the Rust optimizer produces the final
   library + certified RTP. Belongs in an SDK+Rust environment.
3. **Package + upload** — `package-for-stake.sh` assembles the bundle (with the
   version/`definitionHash` consistency guard) for the Stake Engine dashboard;
   see `docs/stake-engine-submission-checklist.md`.
