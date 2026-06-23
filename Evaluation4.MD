The audit is complete and written to the plan file. Here's the executive summary.
The repo is genuinely strong — the architecture, the shared-definition SSOT concept, the dual math paths, the security boundary ("client never decides outcomes"), the docs/ADRs, and the scaffolder are all real and well-built. The problems are concentrated in correctness/credibility gaps that current tests don't catch because they only exercise the standalone/mock path.
The five P0s:
Event-schema drift (verified by reading both sides). The certified SDK (game_events.py) emits lineWin/freeSpinUpdate and omits freeSpinEnd; the frontend contract (events.ts + bookPlayer.ts) expects lineWins/freeSpinResult/freeSpinEnd. The standalone engine matches the contract; the SDK does not — and the docstrings falsely claim they're consistent. Production serves SDK books → wins silently fail to render. No test catches it.
No parity gate between the two math engines and no book-schema validation in CI — you validate RTP on one engine and certify the other.
Buy-bonus EV not actually proven — the test allows rtp < 1.15 (115%), which permits an EV-positive buy, the exact thing SECURITY.md forbids.
False-green RTP gate — ±5% tolerance plus hash(mode)-based, process-dependent seeding (non-reproducible across runs).
No runtime schema validation of the definition/books on either side, and RNG provenance is undocumented.
P1 covers E2E tests, RGS resilience (timeout/retry/session-resume), statistical math tests, CI security scanning + coverage, pre-commit, and env pinning. P2 covers i18n, responsible gaming, accessibility, performance hardening, telemetry, and multi-game CI scaling. The full prioritized table (with file paths, fixes, and S/M/L effort), the top-5 risks, and a "what I'd add" section are all in the plan file.
The plan file doubles as a remediation roadmap. I'll exit plan mode so you can review the full audit and decide whether you'd like me to implement any of the fixes (the P0s are the natural first batch).

AetherSpin Repository Audit & Hardening Plan
Context
AetherSpin aims to be the definitive, future-proof starter kit for shipping
certified Stake Engine slot titles, plus a flagship game (NovaForged). The repo
is already impressively complete for a "scaffold": stdlib-only simulator + an
official StakeEngine/math-sdk path, a single shared game-definition.json,
a typed Svelte/Pixi client with an RGS wrapper + mock RGS, pnpm/Turborepo, three
CI workflows, Dependabot, Storybook, ADRs, and a new-game.sh scaffolder.
This audit verified claims against the actual code (not the README). The
architecture is sound and the security boundary ("client never decides
outcomes") is genuinely enforced. The gaps that matter are correctness/
credibility issues that the existing tests do not catch because they only
exercise the standalone/mock path — most importantly a real event-schema
drift between the certified math path and the frontend contract, and RTP/
buy-bonus gates that are too loose to be trustworthy. The plan below is an
audit + remediation roadmap; it does not rewrite the repo.
Note: This is an audit deliverable. The prioritized findings, risks, and
recommendations follow. Nothing here has been applied to the repo.
Prioritized findings
P0 — Correctness / credibility (fix before any cert submission)
#
What's missing / wrong
Why it matters
Concrete fix (files / tools)
Effort
P0-1
Event-schema drift between the certified SDK path and the frontend contract. math/games/novaforged/game_events.py emits lineWin (singular), freeSpinUpdate, and omits freeSpinEnd. The canonical contract shared/src/types/events.ts + frontend/src/core/bookPlayer.ts expect lineWins (plural, batched), freeSpinResult, and freeSpinEnd. The standalone math/simulator/engine.py matches the contract; the SDK does not. Worse: events.ts:6-7 claims the SDK is "kept consistent," and game_events.py:5 references a non-existent frontend/src/core/bookEvents.ts.
The mock + standalone books used in all tests use schema A; the real RGS serves the SDK's schema B. The frontend's never guard in bookPlayer.ts is compile-time only, so at runtime unknown events are silently dropped → on a certified build, line wins and per-spin free-game updates don't render. No test catches it. This is the difference between "passes locally" and "visibly broken in cert review."
Make the SDK game_events.py emit the exact contract (lineWins batched, freeSpinResult, freeSpinEnd), OR redefine the contract once and conform both. Then add a cross-language golden-book parity test: same seed → both engines → assert identical event streams. Fix the stale docstrings.
M
P0-2
No enforced parity between the two math paths and no book-schema validation in CI. "Single source of truth" is claimed but only the definition is shared; the two engines re-implement event emission independently (engine.py vs game_executables.py/game_events.py). Generated books are never validated against a schema.
The library you certify (SDK) is not the one you validate RTP on (standalone). Any divergence in RTP, event order, or wincap behavior ships uncaught.
Add a shared/schemas/book.schema.json; validate math/library/**/books_*.jsonl against it in ci.yml. Add a parity test (P0-1) and a "standalone vs SDK RTP within ε" test.
M
P0-3
Buy-bonus EV is not actually proven non-positive. math/tests/test_engine.py asserts bonus rtp < 1.15 on only 20k sims. A 115% threshold permits an EV-positive buy — the exact thing SECURITY.md forbids.
An EV-positive bonus buy is a hard compliance/cert failure and a direct operator loss. The current test would pass a broken game.
Assert bonus RTP <= rtpTarget + small_tol (e.g. ≤ 0.98) at high sample via the SDK run (run_config.toml already does 200k bonus). Document the threshold + rationale. Wire into math-validation.yml.
S
P0-4
RTP gate is too loose + seeding is non-reproducible. validate_rtp.py gates CI at ±5% on 150k sims (ci.yml). A game materially off-target passes. runner.py seeds with seed*1_000_003 + hash(mode)%1000 + i — hash(str) varies per process (PYTHONHASHSEED), so "reproducible" runs aren't.
Loose gate + non-determinism = false green. For a "production-grade" claim and for regulator-grade reproducibility, this is a credibility hole.
Replace hash(mode) with a fixed numeric mode→offset map; set PYTHONHASHSEED=0 in CI. Tighten the gate using a confidence-interval/variance-aware check, or raise sims + lower tol on the nightly path.
M
P0-5
No runtime validation of game-definition.json against shared/schemas/game-definition.schema.json. Frontend casts as unknown as GameDefinition (gameConfig.ts:13); CI never runs the JSON Schema. RNG provenance is undocumented (rng.py Mersenne Twister; SECURITY.md silent that it's dev-only and that prod RGS supplies the certified RNG).
The definition is the SSOT but unenforced — a corrupt/edited definition breaks silently in both engines and the client. RNG provenance is a standard cert question with no documented answer.
Add an ajv (CI) + zod/ajv (frontend load) validation step against the existing schema. Add an RNG-provenance section to SECURITY.md stating the standalone RNG is dev/CI-only and the certified RGS owns production RNG.
S
P1 — Professional polish (expected of a top-tier studio)
#
What's missing
Why it matters
Concrete fix
Effort
P1-1
No E2E tests. Unit tests are solid (*.test.ts, test_engine.py) but the full authenticate→play→reveal→endRound flow is untested; Svelte components have Storybook stories but no behavior tests.
The integration seams (where P0-1 lives) are exactly what's untested.
Add Playwright: spin N rounds against mock RGS, assert balance/UI/feature transitions. Add @testing-library/svelte component tests. Wire into ci.yml.
M
P1-2
RGS client lacks resilience. rgsClient.ts: no request timeout, no retry/backoff, no re-auth on ERR_IS, ignores auth.round (no pending-round recovery), no book validation before replay.
Real-money players on flaky networks lose spins / get locked out; an unresolved round is dropped on reconnect.
Add timeout (Promise.race), bounded exponential backoff on ERR_UE, re-auth+retry on ERR_IS, resolve auth.round on connect, validate book vs book.schema.json (P0-2) before replay.
M
P1-3
Thin math test coverage — structural only. One file, ~7 tests. No property/statistical tests (hit-frequency, feature-trigger rate ~1/130, wincap frequency, win-distribution bands). generate_par_sheet.py untested.
High-volatility correctness can't be proven by a single mean; reel imbalances slip through.
Add property-based tests (hypothesis optional, or seeded statistical assertions with tolerances) + a PAR-sheet smoke test.
M
P1-4
CI security/quality gaps. No secret scanning, no SAST, no coverage reporting, no schema-validation job. Storybook is configured but never built/deployed; no visual regression.
Standard supply-chain + credibility expectations; coverage drift invisible.
Add gitleaks + CodeQL workflows; collect Vitest/pytest coverage (Codecov); add a check-schema job; build Storybook in CI (+ Chromatic or Playwright snapshots for VRT).
S–M
P1-5
No pre-commit hooks; env not fully pinned. No husky/lint-staged or pre-commit; no .python-version; requirements.txt not lock-pinned; no devcontainer.
Lint/format failures reach CI late; "works on my machine" math runs.
Add husky + lint-staged (prettier/eslint) and a .pre-commit-config.yaml (ruff). Add .python-version (3.11.x), pin deps, optional .devcontainer.
S
P1-6
Docs/governance gaps. No CONTRIBUTING.md, no deployment/troubleshooting guide; CODEOWNERS is a single-user placeholder; no branch-protection doc.
Onboarding + operational clarity for a studio shipping many titles.
Add CONTRIBUTING + deploy/runbook docs; populate CODEOWNERS with teams; document required checks.
S
P2 — Scale / UX / compliance
#
What's missing
Why it matters
Concrete fix
Effort
P2-1
No i18n. All UI strings hard-coded English; lang URL param parsed but ignored; formatCurrency locale never wired from lang.
Multi-market operators require localization; this blocks real distribution.
Add svelte-i18n/lightweight loader; extract strings to locales/*.json; drive from lang param; wire locale into gameConfig.ts currency formatting.
M
P2-2
No responsible-gaming features. No session/reality-check timers, loss limits, or autoplay caps beyond UI counts; no RG config.
Regulatory requirement in most jurisdictions; operator compliance review will flag it.
Add an rg block to the definition/schema; implement session timer + reality-check modal + autoplay/loss limits in gameState.ts; surface RG links.
M
P2-3
Accessibility gaps. No prefers-reduced-motion, no ARIA live region for the Pixi canvas (wins/features unannounced), no keyboard shortcuts, contrast unaudited; no a11y CI.
Legal (WCAG/ADA) + inclusive-design expectation; canvas games are a known a11y risk.
Add reduced-motion paths in Stage.ts/ReelEngine.ts; an aria-live region announcing wins/feature events; hotkeys; add axe/Lighthouse to CI.
M
P2-4
Performance hardening. No texture/asset preload phase (first reveal can stutter), no teardown/memory cleanup for long sessions, no adaptive FPS, FPS monitored but not acted on.
60fps claim is aspirational without preload + cleanup; long sessions can leak.
Pre-generate symbol textures in Stage.init(); add ReelEngine destructor + bus.clear(); optional adaptive cap; bundle-size + Lighthouse budget in CI.
M
P2-5
No telemetry / error reporting. Errors only hit console; no Sentry.
Production issues undiagnosable.
Add Sentry (web) + structured spin-latency/FPS/error metrics.
S
P2-6
Scaffolding & packaging polish. new-game.sh only clones from novaforged; package-for-stake.sh doesn't validate the bundle (non-empty books, index.json present), no checksums, no pre-flight (RTP/schema). CI validates only novaforged — not every game in shared/games/.
A studio shipping many titles needs every game gated and bundles verified.
Add bundle validation + checksums + pre-flight to package-for-stake.sh; make CI iterate over all shared/games/* (matrix).
S–M
Biggest risks (top 5)
Event-schema drift (P0-1). The certified math path emits events the
frontend doesn't handle; the mock hides it. A cert build renders wins
incorrectly while every local test is green. This is the single most
dangerous item.
Two unverified "sources of truth" for math (P0-2). You validate RTP/PAR
on the standalone engine but certify the SDK engine, with no parity gate —
what you sign off may not be what you ship.
Buy-bonus EV not proven (P0-3). A 115%-RTP test threshold can pass an
EV-positive buy — a direct compliance failure and operator-loss vector.
False-green RTP gate (P0-4). ±5% tolerance plus hash()-based,
process-dependent seeding means CI can be green on an off-target,
non-reproducible game — fatal to a "production-grade / regulator-ready" claim.
No runtime contract/schema validation (P0-5). Definition and books are
trusted blindly on both sides; corruption or edits fail silently, with no
defense in depth and no documented RNG provenance.
What I'd add that you didn't ask about
One canonical event schema with codegen. Define the book/event vocabulary
once as JSON Schema and generate the TS types and a Python validator from it.
This makes P0-1 structurally impossible rather than a convention to remember.
Committed golden-book fixtures + cross-language contract test. A small,
deterministic set of books replayed by both the Python tests and the
frontend tests — the only real guard against math↔client drift.
RGS protocol conformance harness. Generate the mock RGS from the same
Stake Engine wallet spec the real RGS implements (OpenAPI), so the mock can't
diverge from production semantics (status codes, pending rounds, idempotency).
Reproducibility/audit trail for regulators. Pin PYTHONHASHSEED, document
the seed strategy, and add a make reproduce-library GAME=… COMMIT=… target
that regenerates a byte-identical certified library from a commit — auditors
ask for this.
Per-release math sign-off artifact. Auto-generate the PAR sheet from the
SDK path (1M+), plus max-win hit probability and feature frequencies, stored
as a release artifact (the nightly workflow is 80% there).
Multi-game CI matrix. Validate every shared/games/*, not just
novaforged, so the kit actually scales to many titles.
Asset pipeline + license manifest. The procedural-render trick is elegant
for a scaffold, but real titles need an art/audio pipeline and a provenance/
license manifest for every asset (operators ask).
Mid-feature disconnect/resume UX. Recovering a partially-played free-spins
round on reconnect is essential for real-money player trust (ties to P1-2).
Performance budgets in CI. Enforce bundle-size and Lighthouse/60fps budgets
so the performance claim is continuously verified, not aspirational.
Verification (how to confirm the P0 findings)
P0-1: Compare shared/src/types/events.ts (event union) against
math/games/novaforged/game_events.py factories — lineWin vs lineWins,
freeSpinUpdate vs freeSpinResult, missing freeSpinEnd. Confirm
bookPlayer.ts has no handler for the SDK names. (Verified during audit.)
P0-3/P0-4: Read math/tests/test_engine.py (threshold 1.15, 20k sims)
and math/scripts/validate_rtp.py / ci.yml (--sims 150000 --tol 0.05),
and the hash(mode) seed in math/simulator/runner.py.
Post-fix validation: run python -m pytest math/tests,
python math/scripts/validate_rtp.py --game novaforged --sims 1000000, the new
parity test, pnpm --filter @aetherspin/frontend test, and a Playwright E2E
spin run against the mock RGS.
