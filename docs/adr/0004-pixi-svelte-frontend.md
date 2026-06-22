# ADR 0004 — PixiJS + Svelte frontend

- **Status:** Accepted
- **Date:** 2026
- **Deciders:** AetherSpin Studio

## Context

The web client must render a 60 FPS animated slot — spinning reels, win highlights, particle/feature
effects — **inside a Stake CDN iframe**, while also presenting standard HUD chrome (balance, bet
selector, paytable, autoplay). It is strictly a presentation layer: it replays server-authoritative
book events and never computes outcomes. We needed a rendering engine for the game canvas and a UI
framework for the chrome, with a small bundle and good DX.

## Decision

Use **PixiJS 8** for the WebGL game canvas and **Svelte 4 + TypeScript 5** for the surrounding UI,
built with **Vite 5**. Audio via **Howler**. The build sets `base: "./"` for path-independent
serving inside the CDN iframe.

Division of labour:

- **Pixi** owns the high-performance render loop (reels, symbols, win/feature animation) against a
  60 FPS budget.
- **Svelte** owns reactive HUD components and stores (balance, bet, round state) with minimal runtime
  overhead and no virtual DOM.
- **TypeScript** consumes the shared `@aetherspin/shared` types so the client speaks the exact
  game-definition and book-event contracts.

## Consequences

**Positive**

- Pixi gives GPU-accelerated rendering suited to slot animation; Svelte compiles to small, fast DOM
  code ideal for an iframe-hosted game.
- Vite delivers fast HMR dev loops and an optimized production bundle; `base: "./"` makes it
  CDN-portable.
- Shared TS types keep the client honest about the math contract; the mock RGS enables full local
  development without a server.
- Vitest + svelte-check + ESLint + Storybook provide a complete QA story.

**Negative / trade-offs**

- Two rendering paradigms (Pixi canvas + Svelte DOM) must be bridged and kept in sync via stores.
- Pixi 8 and Svelte 4 each have their own learning curve and lifecycle/teardown discipline (texture
  and ticker disposal to avoid leaks in long autoplay).

## Alternatives considered

- **Pixi + React** — rejected: heavier runtime and reconciliation overhead than Svelte for an
  iframe-hosted game; larger bundle.
- **HTML/CSS/Canvas-2D only** — rejected: insufficient for smooth 60 FPS WebGL slot effects.
- **A full game engine (Phaser)** — rejected: more than needed; Pixi gives us the renderer without
  imposing an opinionated game loop, and Svelte handles UI better than Phaser's DOM story.
- **Svelte 5 (runes)** — deferred: Svelte 4 is the current stable target for the toolchain; migration
  can be a later ADR.
