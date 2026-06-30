# Stake Engine review prompt

Paste the block below into a fresh Claude Code session at the repo root to get a
structured audit of the code against Stake Engine submission guidelines. It's
written to make the model _verify against the running code and gates_, not just
read — and to ground itself in the official requirements first.

---

```
You are reviewing the AetherSpin monorepo for readiness to submit three slot
games (NovaForged · lines, Cosmic Ways · ways, Stellar Clusters · cluster) to
Stake Engine (stakeengine.com). Audit the code against Stake Engine's
guidelines and report findings. Be rigorous and adversarial: prove each claim
against the actual code or by running a gate — do not take comments or docs at
face value.

GROUND YOURSELF FIRST (read, in this order):
- docs/stake-engine-submission-checklist.md  (our checklist)
- SECURITY.md                                (server-authoritative model)
- docs/adr/0005-*.md                         (SDK ↔ standalone parity, optimizer)
- docs/sdk-certification-runbook.md          (the certified optimizer run)
- shared/src/types/events.ts                 (the BookEvent contract)
- CLAUDE.md                                   (repo rules of the road)
If you have web access, also consult the official Stake Engine docs and the
StakeEngine/math-sdk README to confirm current requirements (book/lookup-table
format, RGS wallet API, payout units, win-cap rules) rather than assuming.

REVIEW DIMENSIONS — for each, state PASS / CONCERN / FAIL with evidence
(file:line or command output):

A. Server-authoritative outcomes (the #1 rule)
   - The client NEVER decides RNG or payouts. Verify frontend/src/core/bookPlayer.ts
     replays book events and never recomputes a win; mockRgs is dev-only.
   - All randomness/payouts are server-side (math/). Flag any client-side outcome math.

B. Math correctness & determinism
   - Standalone (math/simulator) and certified SDK (math/games/<id>) agree on the
     mechanic. Run: python -m pytest math/tests -q
   - Determinism: same seed → identical library (PYTHONHASHSEED pinned).

C. RGS / book conformance (the hard upload rules)
   - Run the SDK's own verifier where available:
     bash scripts/check-sdk-parity.sh novaforged   (and cosmicways, stellarclusters)
     This runs execute_all_tests = verify_lookup_format + book/LUT payout-hash +
     SHA-256. Confirm it PASSES for both modes of each game.
   - Lookup-table payouts: non-negative integers, divisible by 10, min non-zero 10
     (0.1x increments). Verify quantization in math/games/<id>/game_override.py.
   - Books carry id / payoutMultiplier / events; events map onto the shared
     BookEvent union (validate_sdk_books.py). payoutMultiplier == finalWin amount.

D. RTP / PAR / win-cap
   - Target RTP enforced (0.965). The CERTIFIED rtp comes from the optimizer:
     scripts/run-certification.sh <game> (needs Python 3.12 + Rust). Confirm
     post-optimization RTP ≈ target for base and bonus.
   - Buy-bonus must NOT be player-EV-positive (bonus RTP ≤ ~target).
   - Win cap (5000x) enforced and reachable (WCAP reels / forced-wincap dist).

E. Frontend RGS integration & resilience
   - authenticate → play → end-round; events replayed in order; no double-settle,
     no lost win on a transport blip (bookPlayer.settleRound). Malformed responses
     rejected (isValidBook). Run: pnpm --filter @aetherspin/frontend test

F. Mandatory UI & compliance
   - Balance, bet levels (min/max/step/default), win display, paytable/rules,
     autoplay+stop, bonus-buy pricing, spin/stop, free-spins indicator, error
     states, responsible-gaming affordances. Check each component exists and is
     bound to the shared definition (no hardcoded paytable/bet values).
   - Version consistency: python scripts/check-version-consistency.py <game>
     (definition ↔ config ↔ bundle, incl. definitionHash).

G. Build / packaging / performance
   - pnpm --filter @aetherspin/frontend run check && test && build
   - bash scripts/preflight.sh <game> ; bash scripts/package-for-stake.sh <game>
   - Vite base "./" for iframe; Pixi texture/ticker disposal; 60fps budget.

H. Anything that contradicts a Stake guideline, a hardcoded value that should come
   from shared/games/<id>/game-definition.json, or a TODO/placeholder that would
   ship.

OUTPUT:
1. A table: dimension → PASS/CONCERN/FAIL → one-line evidence.
2. A ranked list of findings (most severe first): file:line, what's wrong, why it
   matters for Stake submission, and a concrete fix.
3. A short "submission-readiness" verdict per game.
Run the gates you cite; quote real output. Where a gate needs Python 3.12 + Rust
or the vendored SDK and they're absent, say so explicitly rather than guessing.
```

---

Tip: for a deeper pass, run it once focused on **math/RGS** (dimensions B–D) and
once on **frontend/compliance** (A, E–G), so each review stays within context.
