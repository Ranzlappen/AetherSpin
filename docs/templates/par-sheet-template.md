# PAR Sheet — &lt;Game Name&gt; v&lt;version&gt;

> **Probability Accounting Report** template. A **filled** version is produced automatically by
> `python3 math/scripts/generate_par_sheet.py --game <game-id> --sims <N> --out docs/<game-id>-par-sheet.md`,
> which emits the headline metrics and the win-distribution histogram below from a simulation run.
> Use this template for the structure and for any narrative the generator does not produce.

_Generated from &lt;N&gt; simulated base-game rounds (standalone engine, seed &lt;seed&gt;)._

> NOTE: Standalone figures are an engineering estimate. **Certified** figures come from the official
> math-sdk pipeline (millions of spins + Rust optimizer).

---

## Headline metrics

| Metric              | Value                      |
| ------------------- | -------------------------- |
| Target RTP          | &lt;%&gt;                  |
| Measured RTP        | &lt;%&gt;                  |
| Hit frequency       | &lt;%&gt; (1 in &lt;n&gt;) |
| Free-spin frequency | &lt;%&gt; (1 in &lt;n&gt;) |
| Max win cap         | &lt;x&gt;                  |
| Max win observed    | &lt;x&gt;                  |
| Wincap frequency    | &lt;%&gt;                  |
| Volatility          | &lt;class&gt;              |

## Win distribution

| Win band    | Count | Probability |
| ----------- | ----- | ----------- |
| 0x (no win) |       |             |
| 0x–1x       |       |             |
| 1x–2x       |       |             |
| 2x–5x       |       |             |
| 5x–10x      |       |             |
| 10x–50x     |       |             |
| 50x–100x    |       |             |
| 100x–500x   |       |             |
| 500x–1000x  |       |             |
| 1000x–5000x |       |             |
| ≥5000x      |       |             |

## Per-mode summary

| Mode  | Cost       | Measured RTP | Notes                                         |
| ----- | ---------- | ------------ | --------------------------------------------- |
| base  | 1.0×       |              |                                               |
| bonus | &lt;N&gt;× |              | Measured against the buy cost; must be ≤ 100% |

## Feature accounting (narrative)

- **Free spins:** trigger probability, average spins, average feature win, retrigger rate.
- **Multiplier ladder:** distribution of terminal multiplier (×1/×2/×3).
- **Multiplier / expanding wilds:** contribution to feature EV.
- **Bonus buy:** EV vs cost; confirmation it is not player-positive.

## Methodology

- Engine: standalone (`math/simulator`) / official math-sdk
- Sample size, seed, and tolerance
- Optimizer knobs applied (paytable scalar, `winScale`) or Rust optimizer settings
- Win cap enforcement
