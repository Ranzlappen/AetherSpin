# RNG Provenance & Reproducibility

This document is the chain-of-custody reference for randomness in AetherSpin. It
exists so an auditor, reviewer, or future maintainer can answer two questions
without reading the whole engine:

1. **Where does randomness come from at play time?** (Not from this repo.)
2. **How is the simulation library produced, and how do I reproduce it
   byte-for-byte?**

---

## 1. Who owns randomness

| Context                           | Randomness source                                | Notes                                                                                                                       |
| --------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Production play**               | **Certified Stake RGS**                          | The RGS selects which pre-verified book to serve and is the sole authority on outcomes, payouts, and balance.               |
| **Library generation** (dev / CI) | `math/simulator/rng.py` (seeded `random.Random`) | Offline only. Produces the books + lookup tables that the RGS later draws from. Deterministic, never live entropy.          |
| **Frontend**                      | **none**                                         | The client only _replays_ the book the RGS committed to. It never draws randomness or computes a payout. See `SECURITY.md`. |

The golden rule (`SECURITY.md`): **the client never decides outcomes**, and the
bundled simulator RNG is **not** a production entropy source. It is a
deterministic library generator whose entire value is reproducibility — which is
exactly why it must never be used as live randomness.

---

## 2. Determinism

Generation is reproducible by construction:

- **`PYTHONHASHSEED=0`** is pinned in CI (`ci.yml`, `math-validation.yml`) so set
  / dict ordering can never perturb sampling.
- **Fixed per-mode seed offsets** — `MODE_SEED_OFFSET = {"base": 101, "bonus": 202}`
  in `math/simulator/runner.py` (with a `zlib.crc32` fallback for unknown modes)
  replace any process-salted `hash()`, so each mode reseeds to a stable value.
- A given **commit + base seed** therefore yields a **byte-identical** library.

Verify locally:

```bash
PYTHONHASHSEED=0 python3 math/scripts/generate_books.py --game novaforged --sims 5000
sha256sum math/library/novaforged/books/books_base.jsonl
# regenerate and compare — the hash must match
PYTHONHASHSEED=0 python3 math/scripts/generate_books.py --game novaforged --sims 5000
sha256sum math/library/novaforged/books/books_base.jsonl
```

---

## 3. The provenance stamp

Every generated `configs/config.json` carries a `provenance` block
(`build_provenance` in `math/simulator/runner.py`):

| Field                  | Meaning                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `gitCommit`            | Source revision that produced the library. Prefers `GITHUB_SHA` (CI), else local `git rev-parse HEAD`, else `"unknown"` (off-VCS tarball). |
| `seed`                 | Base seed passed to generation.                                                                                                            |
| `definitionHash`       | SHA-256 of the canonical (sorted, minified) `game-definition.json`.                                                                        |
| `reelHashes`           | SHA-256 per reel CSV under `math/games/<id>/reels/`.                                                                                       |
| `simulatorVersion`     | Version of the standalone engine that generated the books.                                                                                 |
| `generatedAt`          | UTC timestamp (informational; not part of the reproducible hash).                                                                          |
| `pythonHashSeedPinned` | `true` — asserts the determinism precondition held.                                                                                        |

### Regenerate-and-verify procedure (for auditors)

1. `git checkout <gitCommit>` from the stamp.
2. Re-run generation with the recorded `seed` and `PYTHONHASHSEED=0`.
3. Confirm `definitionHash` and each `reelHashes` entry match the stamp (the
   inputs are unchanged).
4. Diff the regenerated `books_*.jsonl` against the submitted library — they must
   be byte-identical.

`math/scripts/validate_books.py` independently re-checks structural integrity
(id contiguity, wincap, event ordering/shape) of any library.

---

## 4. Production note

The certified math library is the artifact the RGS serves; the official
`StakeEngine/math-sdk` (millions of spins + Rust optimizer) produces the
**certified** library for final submission. The standalone simulator documented
here is for development, CI, and RTP analysis — its provenance stamp travels with
the dev/staging library and is the template the certified pipeline mirrors.
