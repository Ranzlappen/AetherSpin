# ADR 0003 — Shared game-definition as single source of truth

- **Status:** Accepted
- **Date:** 2026
- **Deciders:** AetherSpin Studio

## Context

Symbols, paytable, paylines, bet levels, and feature parameters are needed by **three** consumers:
the standalone math engine, the official-SDK game, and the frontend. If each kept its own copy, they
would inevitably drift — a paytable tweak in the math that the UI's paytable screen doesn't reflect,
or bet levels that disagree between client and server. For a certified gambling product, such drift is
unacceptable.

## Decision

Define each game with **exactly one canonical file**:
`shared/games/<game-id>/game-definition.json`. It is:

- **Validated** by `shared/schemas/game-definition.schema.json` (JSON Schema draft-07).
- **Typed** by `shared/src/types/game.ts` (and the event contract by `events.ts`).
- **Read directly** by all three consumers:
  - `math/simulator/definition.py` → `GameDefinition` dataclass
  - `math/games/<game>/game_config.py` → `_load_shared_definition()`
  - `frontend/src/config/gameConfig.ts` → typed import

No consumer maintains its own copy of these numbers. The definition also encodes the protocol
constants (`apiAmountMultiplier = 1,000,000`, `bookAmountMultiplier = 100`) so amount handling is
consistent everywhere.

## Consequences

**Positive**

- The math and the visuals **cannot drift** on game numbers — one edit propagates to all three.
- The schema makes invalid definitions fail fast; TS types give the frontend compile-time safety.
- Retargeting the frontend to a new game is essentially a one-line import change.
- The RTP optimizer can write tuned values (paytable scalar, `winScale`) **back** into the one file
  and every consumer picks them up.

**Negative / trade-offs**

- The schema is a coupling point — adding a feature field means updating the schema **and** the TS
  types **and** the consumers that read it.
- A single JSON shape must serve different runtimes (Python, the SDK's `(count, symbol)` paytable
  form, TS). Each consumer adapts the shape locally (e.g. `game_config.py` reshapes the paytable).

## Alternatives considered

- **Per-consumer config copies** — rejected: drift is inevitable and dangerous for certified math.
- **A code-generation step** (emit Python + TS from one source) — rejected as over-engineering for
  the current scale; a validated JSON file read directly is simpler and equally safe.
- **A database/service of record** — rejected: unnecessary infrastructure; a versioned file in the
  repo is auditable and reviewable in PRs.
