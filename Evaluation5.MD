AetherSpin — Repository Audit
Verdict: The bones are genuinely strong. There's a real single-source-of-truth contract (shared/games/<id>/game-definition.json consumed by the Python simulator, the official-SDK game, and the TS frontend — no hardcoded paytable/symbol values found in either side), a working game scaffolder (scripts/new-game.sh), substantive docs + 4 ADRs, a clean RGS client boundary, and a buy-bonus model that decouples base/bonus RTP via a paytable scalar + winScale. The gaps are about closing the loop: validating the contract at runtime/CI, proving (not asserting) compliance properties, and the last-20% polish a top-tier studio expects.
P0 — Correctness & credibility
#
What's wrong
Why it matters
Fix
Effort
P0-1
Buy-bonus "EV guard" doesn't enforce its claim. math/tests/test_engine.py:80 asserts rtp < 1.15 (permits 115% = EV-positive) on only 20k sims, but SECURITY.md:45 says the buy is "not EV-positive… this test guards it."
A reviewer reads the SECURITY claim against the test. Allowing 115% while claiming the opposite is a credibility/compliance hole.
Tighten to bonus_rtp <= rtpTarget + tol (~0.98), raise sims ≥200k, reconcile SECURITY.md.
S
P0-2
Nothing validates game-definition.json against its schema. shared/schemas/game-definition.schema.json exists; Python (simulator/definition.py) and TS (gameConfig.ts:9, as unknown as) both just cast. Not in CI.
The whole SSOT guarantee is hollow if the source can drift unvalidated — fails at runtime post-deploy, silently for some fields.
ajv/Python schema check in CI over shared/games/*; jsonschema in load_definition(); TS runtime/build guard.
M
P0-3
Books written with no validity checks. library.py/generate_books.py don't assert unique/contiguous ids, payoutMultiplier <= wincap, schema conformance, or event ordering — despite the submission checklist saying to.
One malformed book is a live-money incident; certification expects provable integrity.
New validate_books.py; wire into build-all.sh, package-for-stake.sh, CI.
M
P0-4
Two math implementations, no equivalence test. simulator/engine.py and math/games/novaforged/game_calculations.py re-implement line/scatter logic; only the simulator is tested.
Dev/CI validate the standalone engine, but the SDK produces the certified books — they can silently diverge.
Cross-check test: both engines on identical seeded inputs → equal results / RTP within tolerance. Gate in CI.
M
P0-5
No enforced event-schema contract. Python emits dict events; TS has a hand-written BookEvent union (shared/src/types/events.ts). Manual alignment only.
Classic book/event drift: a new field surfaces only when the client mis-renders a real book.
Validate emitted events against schema in generate_books.py; TS test parsing sample books; optionally generate TS from schema.
M
P0-6
RGS client: no timeout, no retry, shallow validation. frontend/src/core/rgsClient.ts uses bare fetch; readRound() only optional-chains.
Real-money client: a hung /wallet/play strands a round; a malformed response crashes replay.
AbortController timeout + bounded backoff on idempotent calls; validate Book shape at boundary; extend rgsClient.test.ts.
M
P1 — Professional polish
#
What's missing
Why
Fix
Effort
P1-1
CI gates only NovaForged (ci.yml:40 hardcodes --game novaforged).
Game #2 ships ungated — directly undercuts the "many titles" mission.
Discover shared/games/* (minus template), matrix the jobs.
S
P1-2
No pre-commit hooks.
Slow feedback; broken format/types reach CI.
lefthook: prettier/eslint/svelte-check + fast pytest.
S
P1-3
--no-frozen-lockfile in all CI installs (ci.yml:65,97, release.yml:40).
Silent dependency drift; non-reproducible builds.
Switch to --frozen-lockfile.
S
P1-4
No coverage gating (Vitest configured but never run with --coverage; math has none).
"Tested" regresses quietly.
vitest --coverage + pytest --cov w/ thresholds.
S
P1-5
No E2E / visual regression. Unit tests do exist (rgsClient, mockRgs, bookPlayer, gameState, gameConfig) + Storybook, but no Playwright flow, no snapshots.
Replay/animation/RGS-error regressions are exactly what unit tests miss.
Playwright auth→play→win→endRound against mockRgs; Chromatic/Playwright snapshots.
M
P1-6
Storybook built but never deployed.
Reviewers can't see visual changes.
CI build-storybook → Pages; PR preview deploy.
S
P1-7
No secret scanning / SAST (Dependabot only).
Standard for a public, money-adjacent repo.
gitleaks + CodeQL (TS+Python).
S
P1-8
RNG provenance under-documented. simulator/rng.py is random.Random (correctly dev/CI-only; SDK is authoritative) but not flagged where reviewers look.
Reads as "uncertified RNG in a slot" unless explicit.
Banner in rng.py + RNG-provenance section in docs/math-engine.md + checklist.
S
P1-9
Thin math tests (~7 tests / ~700 LoC; no property tests, no feature edge cases).
High-vol correctness lives in the edges.
hypothesis invariants + per-feature unit tests.
M
P1-10
No CHANGELOG / release automation; manual version sync.
Multi-title studio needs traceable releases.
Changesets or release-please.
M
P1-11
No CONTRIBUTING / .python-version / devcontainer.
Repro + onboarding for a reusable scaffold.
Add all three.
M
P2 — Scale / UX / compliance
#
What's missing
Why
Fix
Effort
P2-1
Responsible Gaming minimal (only insufficient-funds + autoplay-stop-on-feature; no reality checks, limits, RTP disclosure, helplines, RESPONSIBLE_GAMING.md).
Hard gate in most jurisdictions + operator review.
Reusable RG module (session timer, autoplay warning, reality-check, RTP/vol readout from definition, helpline footer) + doc.
M
P2-2
A11y gaps (good ARIA, but no keyboard handlers, no prefers-reduced-motion, no focus trap, no <html lang>, likely sub-AA contrast).
Compliance + player-safety (reduced motion for slots).
Keyboard handlers, reduced-motion path in global.css+scenes, modal focus mgmt, set lang, contrast audit.
M
P2-3
No i18n framework (lang/currency parsed, Intl used, but strings hardcoded English; lang unapplied).
Multi-market scaffold needs it from day one.
svelte-i18n, extract en catalog, wire lang, add a 2nd locale.
M
P2-4
Mock RGS ≠ live RTP (procedural weighted-random; no edge tests).
Dev feel/tests drift from real math.
Default mock to real generate_books.py output in assets/books/; edge tests.
S
P2-5
No perf budget/profiling (60fps target + pooling present, but unenforced).
"60fps" should be enforced, esp. once real art lands.
Playwright frame-budget trace + bundle-size budget in CI.
M
P2-6
Doc gaps (no troubleshooting, no field reference, no sample PAR output).
Reduces clone-and-ship value.
Add all three (field ref generated from schema).
S
Biggest risks
Buy-bonus claim vs. reality (P0-1) — doc says "not EV-positive," test permits 115%.
Unvalidated SSOT (P0-2) + unvalidated books (P0-3) — the architecture rests on these being correct; nothing fails fast when they aren't.
Dual-math drift (P0-4) — you can certify SDK math that differs from what dev/CI validated.
Schema drift + brittle RGS client (P0-5/P0-6) — the most likely live failures: new event field or slow/malformed RGS response strands a real-money round.
Single-game CI gate (P1-1) — the repo's purpose is many titles; only NovaForged is protected.
What I'd add that you didn't ask about
Golden-master book corpus committed + diffed in CI (catches silent math regressions below RTP tolerance).
PAR-sheet diff in CI on math PRs — RTP/hit-rate/volatility deltas inline.
Determinism test — generate_books.py --seed S byte-identical across runs/platforms.
scripts/preflight.sh <game> — one command running the full certification gate, printing a green/red mirror of the submission checklist.
SBOM + provenance (CycloneDX/SLSA) on the release bundle.
Opt-in, PII-free telemetry hook in the RGS client so live errors are observable without breaking the "client decides nothing" rule.
new-game.sh smoke test in CI so the scaffolder itself never rots.
The plan file also contains suggested staging (Phase A=P0, B=P1, C=P2) with reuse notes and per-phase verification commands. Since you asked for "the audit and the plan, do not rewrite the repo," the audit above is the deliverable. If you'd like me to proceed with implementing the fixes (starting with Phase A / the P0 items), approve below — otherwise this stays a read-only audit.

AetherSpin — Repository Audit & Hardening Plan
Context
AetherSpin aims to be the definitive, future-proof foundation a studio uses to
ship many certified Stake Engine titles, plus a flagship game (NovaForged, 5×3 /
20-line). This document is an audit + plan, not a rewrite. It was produced by
reading the actual code, tests, CI, docs, and the shared contract and verifying
claims against reality.
Verdict up front: The bones are genuinely strong — a real single-source-of-
truth contract (shared/games/<id>/game-definition.json consumed by Python
simulator, the official-SDK game, and the TS frontend with no hardcoding found),
a working game scaffolder (scripts/new-game.sh), substantive docs + ADRs, a
clean RGS client boundary, and a buy-bonus tuning model that decouples base and
bonus RTP. The gaps are mostly about closing the loop: validating the
contract at runtime/CI, proving (not asserting) compliance properties, and the
"last 20%" of polish a top-tier studio expects (E2E, a11y, i18n, responsible
gaming, release automation).
What follows is the prioritized audit table, the biggest risks, and additions
you didn't ask about. Implementation is staged at the end.
Prioritized audit
Effort: S ≈ <0.5 day · M ≈ 0.5–2 days · L ≈ >2 days.
P0 — Correctness & credibility (could fail certification or an operator's compliance review)
#
What's missing / wrong
Why it matters
Concrete implementation
Effort
P0-1
Buy-bonus "EV guard" doesn't enforce its stated property. math/tests/test_engine.py:80 asserts rtp < 1.15 (permits 115% = EV-positive), but SECURITY.md:45 claims the buy is "not EV-positive for the player" and cites this test. Runs on only 20k sims, seed=3.
Stake/operator compliance reviewers read SECURITY claims against the test. A guard that allows 115% while the doc says "not EV-positive" is a credibility hole and a real compliance risk if winScale ever drifts.
Tighten assertion to a defensible bound tied to rtpTarget (e.g. bonus_rtp <= rtpTarget + tol, ~0.98), raise sample to ≥200k (or add a slow-marked variant), and reconcile wording in SECURITY.md. Reuse run_simulations("novaforged", {"bonus": N}).
S
P0-2
No runtime/CI validation of game-definition.json against its schema. shared/schemas/game-definition.schema.json (draft-07) exists but nothing validates against it — not Python (simulator/definition.py casts), not TS (gameConfig.ts:9 casts as unknown as GameDefinition), not CI.
A malformed/edited definition fails only at runtime after deploy, and silently for some fields (d.paytable["NOPE"] → {}). This is the single source of truth; if it can drift unvalidated, the whole SSOT guarantee is hollow.
Add a CI step validating every shared/games/*/game-definition.json (ajv-cli or tiny Node/Python script). Add jsonschema validation in definition.load_definition() and a runtime guard (or build-time check) on the TS side.
M
P0-3
Books are written without validity checks. math/simulator/library.py / generate_books.py don't assert: unique & contiguous ids, every payoutMultiplier <= wincap, events conform to the schema, or correct event ordering (reveal …  finalWin). Submission checklist says "verify no book exceeds wincap" — but nothing does.
A single malformed book uploaded to the RGS is a live-game incident (stuck round, wrong payout). Certification expects provable book integrity.
Add math/scripts/validate_books.py (or assertions in generate_books.py) checking id contiguity, wincap bound, schema conformance, ordering invariants; call it in build-all.sh, package-for-stake.sh, and CI.
M
P0-4
Two parallel math implementations with no equivalence test. simulator/engine.py and math/games/novaforged/game_calculations.py re-implement line/scatter/expanding-wild logic independently (ADR-0002 accepts this). Only the simulator is tested.
If line-eval logic changes in one and not the other, the certified SDK books differ from what dev/CI validated — RTP/feature drift discovered only at certification.
Add a cross-check test that runs both engines on identical seeded boards/inputs and asserts equal line/scatter results (or equal aggregate RTP within tolerance over a fixed seed set). Gate in CI.
M
P0-5
No event-schema contract enforced between math and frontend. Python emits events as plain dicts; TS has a hand-written BookEvent union (shared/src/types/events.ts). Alignment is manual; no generator, no validator.
A new/renamed event field in math won't surface until the client mis-renders a real book. This is the classic book/event schema-drift failure mode the task calls out.
Make the JSON-schema (or a new event.schema.json) the source; validate emitted events in generate_books.py against it, and add a TS test that parses sample books against the BookEvent union. Optionally generate TS types from schema (json-schema-to-typescript).
M
P0-6
RGS client has no timeout, no retry, no deep response validation. frontend/src/core/rgsClient.ts uses bare fetch (browser default ~unbounded), no backoff, and readRound() does only loose optional-chaining — no validation that book.events match BookEvent.
Real-money client: a hung/slow /wallet/play strands the player mid-round; a malformed RGS response crashes the replay. Robustness here is table stakes for an operator review.
Add AbortController timeout + bounded exponential-backoff retry on idempotent calls (authenticate, balance); validate the Book shape at the boundary (reuse the schema from P0-5); surface ERR_* cleanly. Extend rgsClient.test.ts with timeout/malformed-book cases.
M
P1 — Professional polish
#
What's missing
Why it matters
Concrete implementation
Effort
P1-1
CI validates only NovaForged. ci.yml:40 hardcodes --game novaforged; a second game bypasses the RTP gate entirely.
Directly undercuts the "reusable studio scaffold" goal — the moment you add game #2, it's ungated.
Discover shared/games/* (minus template) and matrix the RTP/schema/book jobs over them.
S
P1-2
No pre-commit hooks. No husky/lefthook/pre-commit; prettier/eslint/tsc/pytest only run in CI.
Slow feedback; broken formatting/types reach CI. A studio scaffold should make "clean by default" the path of least resistance.
Add lefthook (lightest) running prettier + eslint + svelte-check/tsc --noEmit on staged files, plus fast pytest math/tests on Python changes. Mirrors existing root scripts.
S
P1-3
--no-frozen-lockfile in all CI installs (ci.yml:65,97, release.yml:40).
Dependencies drift silently; non-reproducible builds; a supply-chain/repro weakness.
Switch to --frozen-lockfile (commit lockfile first); add pnpm install --frozen-lockfile as the norm.
S
P1-4
No coverage gating. Vitest configured for coverage (vite.config.ts) but CI never runs --coverage; no thresholds. Math has no coverage at all.
"Tested" without a floor regresses quietly.
Run vitest --coverage + pytest --cov in CI with modest thresholds; upload artifact/badge.
S
P1-5
No E2E / visual regression. Frontend has good unit tests (rgsClient, mockRgs, bookPlayer, gameState, gameConfig — note: an automated walk that says "no frontend tests" is wrong) and Storybook stories, but no Playwright flow (auth→play→win→endRound) and no visual snapshots.
Replay/animation/RGS-error regressions are exactly what unit tests miss; this is a rendering product.
Add Playwright running against the mock RGS (mockRgs.ts) for the full round-trip + error toast; add Chromatic/Playwright snapshots over the existing Storybook stories.
M
P1-6
Storybook built but never deployed; no PR previews. .storybook/ present, no CI build/deploy.
Reviewers can't see component/visual changes; loses a cheap quality signal.
Add a CI job to build-storybook and deploy to GitHub Pages (and/or a Vite preview deploy) with a PR link.
S
P1-7
No secret scanning, no SAST. Dependabot is configured, but no gitleaks/trufflehog and no CodeQL/Semgrep.
Standard expectations for a public, money-adjacent repo; cheap to add.
Add gitleaks + CodeQL (TS+Python) workflows; consider Semgrep with a slots/RG ruleset.
S
P1-8
Math RNG is random.Random (stdlib), single choke-point in simulator/rng.py. Correctly not used for certified output (SDK is authoritative), but the boundary/provenance isn't documented where a reviewer looks.
Reviewers must instantly see that the standalone engine is dev/CI-only and certified math comes from the SDK's certified RNG — otherwise it reads as "uncertified RNG in a slot."
Add an explicit banner comment in rng.py + a "RNG provenance" section in docs/math-engine.md and the submission checklist; keep the single choke-point (good design).
S
P1-9
Thin math test suite. ~7 tests for ~700 LoC; no property-based tests, no edge cases (all-wild line, scatter-only, ladder escalation, retrigger), no per-line distribution checks.
High-volatility correctness lives in the edges; structural-only tests give false confidence.
Add hypothesis property tests (invariant: payout <= wincap for all boards; events well-formed) + targeted unit tests for each feature path. Reuse build_engine/play_round.
M
P1-10
No CHANGELOG.md, no release/version automation, manual version sync across package.json, game-definition.json, git tag. release.yml only reacts to hand-cut v* tags.
Multi-title studio needs traceable, reproducible releases.
Adopt Changesets (pnpm-native) or release-please; auto-bump + changelog; verify game-definition version is in the bundle/PAR.
M
P1-11
No CONTRIBUTING.md, no .python-version, no devcontainer. Node/pnpm pinned well; Python only "≥3.11".
Reproducibility + onboarding for a scaffold meant to be reused by a team.
Add .python-version, CONTRIBUTING.md (branch/commit/PR norms), and a .devcontainer/ (or Nix flake) so setup-math + frontend "just work".
M
P2 — Scale / UX / compliance
#
What's missing
Why it matters
Concrete implementation
Effort
P2-1
Responsible Gaming is minimal. Only insufficient-funds + autoplay-stop-on-feature. No reality checks, session/loss limits, autoplay caps/warnings, RTP/volatility disclosure, or helpline links. Submission checklist references RG but there's no RESPONSIBLE_GAMING.md.
RG is a hard gate in most jurisdictions and part of operator compliance review; a "definitive" studio scaffold must ship the pattern.
Add a reusable RG module (session timer, autoplay warning, reality-check modal, RTP/volatility readout sourced from the definition, helpline footer) + docs/RESPONSIBLE_GAMING.md with per-jurisdiction copy.
M
P2-2
Accessibility gaps. Good ARIA labeling exists, but no keyboard handlers for Spin/Bet/Autoplay, no prefers-reduced-motion, no focus trap/return in modals, no lang set on <html>, likely sub-WCAG-AA contrast on neon palette, spin outcomes not announced.
Accessibility is increasingly a compliance + market-access requirement; reduced-motion is also a player-safety expectation for slots.
Add keyboard handlers, a prefers-reduced-motion path in global.css + scene animations, focus management in PaytableModal/BuyBonusButton, set document.documentElement.lang, audit contrast.
M
P2-3
No i18n framework. lang/currency are parsed and Intl.NumberFormat is used, but all UI strings are hardcoded English; lang isn't applied.
A multi-title, multi-market studio scaffold needs i18n from day one; retrofitting later is costly.
Integrate svelte-i18n (or FormatJS), extract strings to en catalog, wire the parsed lang, add a second locale (de/ja) to flush layout/RTL issues.
M
P2-4
Mock RGS ≠ live RTP / weak edge fidelity. mockRgs.ts procedural path is weighted-random, not the tuned distribution; no RTP-convergence or wincap/max-ladder edge tests. README already suggests dropping real books — make that the default dev path.
Dev "feel" and tests drift from real math; bugs at max-multiplier/wincap go unseen.
Wire generate_books.py output into frontend/src/assets/books/ as the default mock source (script/CI step); add edge-case mock tests.
S
P2-5
No performance budget / profiling evidence. TARGET_FPS=60, particle pooling, texture caching, FPS hook all present (good), but no automated 60fps assertion or asset-size budget.
"60fps" should be enforced, not aspirational, especially as real art replaces procedural graphics.
Add a Playwright perf trace asserting frame budget on a scripted spin; add a bundle-size budget check in CI (vite-bundle-visualizer/size-limit).
M
P2-6
Docs gaps: no troubleshooting guide, no human-readable game-definition.json field reference, no PAR-sheet example output committed.
Reduces the scaffold's "clone and ship" value.
Add a troubleshooting section, a definition field reference (generate from schema), and a sample PAR sheet in docs/.
S
Biggest risks (max 5)
Buy-bonus compliance claim vs. reality (P0-1). The doc says "not EV-positive"; the test permits 115%. Either could be quoted in a compliance review — fix the assertion and the wording so they agree and are proven, not asserted.
Unvalidated single source of truth (P0-2) + unvalidated books (P0-3). The entire architecture rests on game-definition.json and the generated library being correct; today nothing fails fast when they aren't. A bad edit reaches runtime/RGS.
Dual-math drift (P0-4). Dev/CI validate the standalone engine, but the SDK produces the certified books. With no equivalence test, you can certify math that differs from what you validated.
Schema drift across the math↔frontend boundary (P0-5) + brittle RGS client (P0-6). The most likely live failure modes: a new event field or a slow/malformed RGS response that strands or mis-renders a real-money round.
Reusability gate is single-game (P1-1). The repo's stated purpose is many titles, but CI only protects NovaForged — game #2 ships ungated. This is the cheapest fix with the highest mission impact.
What I'd add that you didn't ask about
A "golden master" book corpus check. Commit a small set of seeded reference books + their expected aggregate stats; CI fails if engine changes alter them unexpectedly (catches silent math regressions beyond RTP tolerance).
A PAR-sheet diff in CI. Regenerate the PAR sheet and diff headline metrics vs. a committed baseline on PRs touching math — reviewers see RTP/hit-rate/volatility deltas inline.
Determinism/repro test. Assert generate_books.py --seed S is byte-identical across runs/platforms (certification expects reproducible artifacts).
Submission readiness CLI. One scripts/preflight.sh <game> that runs the whole certification gate (schema, RTP@1M, book validation, PAR, version sync, wincap) and prints a green/red checklist mirroring docs/stake-engine-submission-checklist.md.
SBOM + provenance (cyclonedx/SLSA) on the release bundle — operators increasingly ask.
Error/telemetry hook (opt-in, no PII) in the RGS client so live RGS errors are observable — without breaking the "no secrets / client decides nothing" rule.
Template game CI smoke test. Run new-game.sh smoketest in CI and assert it simulates + validates, so the scaffolder itself never rots.
Suggested staging (if you greenlight implementation)
This audit is the deliverable; nothing below is executed without approval.
Phase A (P0, correctness/credibility): P0-1 → P0-6. Reuse existing patterns:
run_simulations/build_engine (math tests), the existing JSON schema, the
RgsTransport interface and rgsClient.test.ts harness. Land schema +
book + event validation as small composable scripts wired into
build-all.sh, package-for-stake.sh, and CI.
Phase B (P1, polish): CI matrix over games, lefthook, frozen lockfile,
coverage, gitleaks/CodeQL, Playwright + Storybook deploy, RNG-provenance docs,
expanded math tests, Changesets.
Phase C (P2, scale/UX/compliance): RG module + docs, a11y pass, i18n,
real-book mock default, perf budget, doc gaps.
Verification per phase
Math/contract: python -m pytest math/tests,
python math/scripts/validate_rtp.py --game novaforged --sims 200000 --tol 0.03,
new validate_books.py, and the schema-validation step on shared/games/*.
Frontend: pnpm --filter @aetherspin/frontend test (+ --coverage),
svelte-check, new Playwright suite against mockRgs, Storybook build.
End-to-end: bash scripts/build-all.sh novaforged then
bash scripts/package-for-stake.sh novaforged must succeed with book
validation passing; bash scripts/new-game.sh smoketest then simulate+validate
the scaffolded game to prove reusability.
