# ADR 0002 — Two math paths: standalone engine and official SDK

- **Status:** Accepted
- **Date:** 2026
- **Deciders:** AetherSpin Studio

## Context

Stake Engine certification requires math produced by the official `StakeEngine/math-sdk`, which
depends on a large Python package set **and a Rust toolchain** for its optimizer and runs production
sample sizes (millions of spins). That pipeline is heavy to set up and slow to run — poorly suited to
the tight loop of designing reels and chasing an RTP target, or to gating every CI build.

We needed fast, hermetic local iteration **and** a certifiable submission path, without the two
diverging.

## Decision

Maintain **two interchangeable math implementations** that read the **same**
`shared/games/<game>/game-definition.json` and the **same** reel CSVs, and emit the **same**
book-event vocabulary:

1. **Standalone engine** (`math/simulator/`) — **Python stdlib only**. Powers local dev, CI, RTP
   reporting, and RGS-compatible book generation. Run instantly with `python3`.
2. **Official-SDK game files** (`math/games/<game>/`) — written against the SDK's `Config` /
   `BetMode` / `Distribution` / `GeneralGameState` API. Become runnable after
   `bash scripts/setup-math.sh` clones the SDK into `math/engine/`. Used for **certified** runs
   (production sample sizes + the Rust optimizer).

Both write the identical `library/<game>/` layout (`books_<mode>.jsonl`, lookup tables,
`config.json`, `index.json`), so they are interchangeable for dashboard upload.

## Consequences

**Positive**

- Sub-second iteration and a fast, dependency-free CI **RTP gate** (`validate_rtp.py`) via the
  standalone engine.
- A clean, certifiable path via the official SDK, with no setup tax until certification time.
- Shared definition + reels + event vocabulary keep the two engines in agreement by construction.

**Negative / trade-offs**

- **Two implementations of the same mechanics** must be kept consistent (line/scatter eval, free
  spins, ladder, wilds). Mitigated by sharing all inputs and the event contract, and by tests.
- Standalone RTP is an **engineering estimate** (smaller samples, simpler optimizer); certified
  figures come from the SDK. The standalone optimizer (`optimize.py`) is a lightweight 2-knob solver,
  not the Rust per-book reweighter.

## Alternatives considered

- **Official SDK only** — rejected: too heavy/slow for the design loop and for CI; Rust + large deps
  on every contributor and every build.
- **Standalone engine only** — rejected: cannot produce certified math for Stake Engine submission.
- **Port the SDK optimizer to Python** — rejected for now: large effort to match the Rust optimizer;
  the 2-knob solver is sufficient for dev/staging while the SDK handles certification.
