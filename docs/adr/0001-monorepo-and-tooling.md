# ADR 0001 — Monorepo and tooling

- **Status:** Accepted
- **Date:** 2026
- **Deciders:** AetherSpin Studio

## Context

An AetherSpin slot game is two tightly-coupled deliverables built in different languages: a Python
**math engine** that produces certified outcomes, and a TypeScript **web client** that renders them.
They share one contract — the game definition (symbols, paytable, paylines, bet levels, features) and
the book-event vocabulary. We needed a repository structure that keeps these in sync, supports fast
local iteration, and gates quality in CI.

Options for repository layout and JS tooling:

- **Polyrepo** — separate repos for math and frontend.
- **Monorepo** with npm/yarn workspaces and no task runner.
- **Monorepo** with **pnpm workspaces + Turborepo**.

## Decision

Adopt a **single monorepo** with **pnpm workspaces** (`frontend`, `shared`) and **Turborepo** for
task orchestration. The Python math engine lives in `math/` and is invoked directly with `python3`
(plus `pnpm math:*` shortcuts in the root `package.json`). CI runs three jobs — math (pytest + RTP
gate), frontend (check/test/build), and lint — via GitHub Actions.

Rationale:

- A change to the shared definition or an event shape is reviewed, tested, and versioned **atomically**
  across math and frontend.
- pnpm gives fast, disk-efficient installs and strict, content-addressed workspace linking
  (`@aetherspin/shared` ↔ `@aetherspin/frontend`).
- Turborepo caches `build`/`test`/`lint`/`check` and runs them across workspaces with one command.
- The math engine is stdlib-only for simulation, so it needs no JS tooling and stays fast in CI.

## Consequences

**Positive**

- Single source of truth and contracts can never drift between the two sides.
- One clone, one `pnpm install`, one CI pipeline; reproducible `pnpm@10` via `packageManager`.
- Cached, parallel task execution speeds up local and CI runs.

**Negative / trade-offs**

- Two toolchains (Node + Python) in one repo; contributors need both.
- Turborepo/pnpm add a small learning curve.
- The Python side sits outside the JS task graph, so math tasks are wired separately (scripts + CI).

## Alternatives considered

- **Polyrepo** — rejected: cross-repo coordination for shared contracts is error-prone and slows
  reviews; versioning drift is likely.
- **npm/yarn workspaces without a runner** — rejected: no task caching/orchestration; slower CI and
  local loops.
- **Nx** — heavier than needed for two workspaces plus a Python engine; Turborepo is leaner.
