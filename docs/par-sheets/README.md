# PAR sheets

PAR (Probability Accounting Report) sheets for AetherSpin games are **generated
on demand**, not committed, because the standalone simulator's headline RTP is a
single-seed engineering estimate — not the certified figure.

## Why no committed headline PAR

NovaForged is high volatility with a 5000× win cap that occurs only ~1 in 500k
spins. A handful of cap hits dominate the RTP estimate, so a single-seed run can
land several percent away from the 96.5% target in either direction (e.g. one
seed reads ~96%, another ~104%) even at one million spins. Committing one such
number would misrepresent the game (and could read as EV-positive when it is
not). RTP is therefore **gated statistically** (`validate_rtp.py`, nightly at 1M
spins) and the **authoritative PAR comes from the official `math-sdk` pipeline**
(millions of spins + Rust optimizer) at submission time.

## Generate one

```bash
# Part of the full gate:
bash scripts/preflight.sh novaforged

# Or directly (writes here):
PYTHONHASHSEED=0 python3 math/scripts/generate_par_sheet.py \
  --game novaforged --sims 1000000 --out docs/par-sheets/novaforged-par-sheet.md
```

Generated `*-par-sheet.md` files in this directory are git-ignored. For a
release, attach the **certified** SDK PAR (and the `submission-manifest.json`
produced by `scripts/package-for-stake.sh`) to the submission.
