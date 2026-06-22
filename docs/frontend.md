# Frontend Architecture & Dev Guide

The AetherSpin web client is a **Vite + Svelte 4 + TypeScript 5 + PixiJS 8** single-page application
that renders a slot game by **replaying** the math engine's book events. It is pure presentation:
the certified server owns every outcome (see
[architecture.md](architecture.md#7-math--frontend-separation)).

> The frontend is under active construction. `src/config/gameConfig.ts` and `vite.config.ts` are in
> place; `src/core`, `src/scenes`, and `src/components` are described here at the architectural
> level. Filenames inside those folders may evolve.

---

## 1. Stack & tooling

| Concern            | Choice                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Build / dev server | Vite 5 (`base: "./"` for CDN-iframe serving; `@/` alias → `src/`) |
| UI framework       | Svelte 4                                                          |
| Rendering          | PixiJS 8 (WebGL canvas)                                           |
| Audio              | Howler                                                            |
| Language           | TypeScript 5 (strict)                                             |
| Test               | Vitest (jsdom)                                                    |
| QA                 | svelte-check, ESLint, Prettier, Storybook                         |
| Shared types       | `@aetherspin/shared` workspace                                    |

Scripts (`frontend/package.json`): `dev`, `build`, `preview`, `lint`, `test`, `test:watch`,
`check`, `storybook`, `build-storybook`.

```bash
pnpm --filter @aetherspin/frontend dev      # dev server (mock RGS)
pnpm --filter @aetherspin/frontend build    # production bundle
pnpm --filter @aetherspin/frontend check    # svelte-check + tsc
pnpm --filter @aetherspin/frontend test     # vitest
```

Why Pixi + Svelte: see
[adr/0004-pixi-svelte-frontend.md](adr/0004-pixi-svelte-frontend.md).

---

## 2. Source layout

```
frontend/src/
├── core/         RGS client, mock RGS, book-event interpreter, reactive stores
├── scenes/       Pixi render layers (base game, free-spins feature)
├── components/   Svelte HUD (balance, bet selector, win display, paytable, autoplay)
├── config/       gameConfig.ts — typed access over game-definition.json
├── assets/       sprites, atlases, audio
├── vite-env.d.ts
└── index.html / main entry
```

### Separation of concerns

- **`config/`** — data only. `gameConfig.ts` is the sole module that reads the raw definition.
- **`core/`** — logic: talk to the RGS, interpret books, hold state. No Pixi/Svelte imports leak
  into config.
- **`scenes/`** — pixels. Subscribe to interpreter/state output and animate.
- **`components/`** — DOM chrome around the canvas.

---

## 3. `config/gameConfig.ts` — the typed data layer

This module imports `shared/games/novaforged/game-definition.json` and casts it to the shared
`GameDefinition` type, then exposes narrow helpers so nothing else re-parses the JSON:

| Export                                                              | Purpose                              |
| ------------------------------------------------------------------- | ------------------------------------ |
| `gameDefinition`                                                    | The fully-typed definition           |
| `NUM_REELS`, `NUM_ROWS`, `WINCAP_MULTIPLIER`                        | Board + cap constants                |
| `TARGET_FPS`, `FRAME_BUDGET_MS`                                     | Performance budget (`60`, `1000/60`) |
| `betLevels`, `defaultBetLevelIndex`                                 | Bet UI binding                       |
| `getSymbol(id)`, `getSymbolColor(id)`                               | Symbol metadata / display color      |
| `getPayout(symbol, count)`                                          | Paytable lookup                      |
| `paylines`                                                          | `[reel] -> row` patterns             |
| `wildSymbolId`, `scatterSymbolId`, `scatterMinToTrigger`            | Feature constants                    |
| `getBetMode(name)`, `buyBonusMode`                                  | Bet-mode descriptors                 |
| `multiplierWildValues`, `multiplierWildWeights`, `ladderConfig`     | Free-spin feature config             |
| `formatCurrency(amount, currency?, locale?)`, `formatMultiplier(m)` | Display formatting                   |

Because this layer is the single read point, retargeting the client to another game is a one-line
import change (plus assets).

---

## 4. RGS client & mock mode

The RGS client (in `core/`) wraps the three protocol calls. **All API amounts are integers equal to
`dollars × 1,000,000`** (`currency.apiAmountMultiplier`).

| Call           | In               | Out                                                         |
| -------------- | ---------------- | ----------------------------------------------------------- |
| `authenticate` | session token    | balance, currency, config                                   |
| `play`         | bet mode, amount | a **book** `{ id, payoutMultiplier, events }` + new balance |
| `end-round`    | round id         | settled balance                                             |

**Mock mode** serves books from the locally generated library
(`math/library/<game>/books_<mode>.jsonl`) so the entire presentation runs with no server — the same
book shapes the live RGS returns. Toggle it via environment/config; default in `dev` is mock.

The client never computes outcomes; it forwards the returned book to the interpreter.

---

## 5. Book-event interpreter & stores

The interpreter (in `core/`) walks a book's `events` in order and translates each into presentation
intents. It targets the canonical vocabulary in `shared/src/types/events.ts` — every event type is
documented with a sample payload in
[architecture.md](architecture.md#5-the-book-event-vocabulary).

| Event               | Presentation effect                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `reveal`            | Spin reels to the board; in free spins, show spin counters, the global multiplier, and expanded reels |
| `lineWins`          | Highlight winning paylines, tally line payouts                                                        |
| `scatterWin`        | Show scatter pay                                                                                      |
| `freeSpinTrigger`   | Transition to the free-spins scene; show spins awarded + start multiplier                             |
| `freeSpinResult`    | Animate one free spin's wins under the active multiplier                                              |
| `ladderStep`        | Advance the ×1→×3 ladder UI                                                                           |
| `freeSpinRetrigger` | Add spins; flash the retrigger                                                                        |
| `freeSpinEnd`       | Total the feature win, return to base                                                                 |
| `finalWin`          | Settle the round total; flag a win-cap hit                                                            |

Reactive **stores** (Svelte stores) hold balance, bet level/mode, and round state; components and
scenes subscribe. Outcomes are server-authoritative — stores reflect, never decide.

---

## 6. Pixi scenes

Scenes are Pixi layers driven by the interpreter:

- **Base game** — reel columns, symbol sprites, payline/win highlight overlays.
- **Free-spins** — distinct backdrop, the multiplier-ladder HUD, expanding-wild animation,
  spins-remaining counter.

Scenes consume `reveal` boards to position symbols and react to win events for animation. Keep heavy
work off the main thread budget; reuse sprite pools rather than recreating textures per spin.

---

## 7. Sound

Audio uses **Howler**, driven by the same event stream — sound hooks fire on `reveal` (spin/stop),
win events (tiered by size), `ladderStep`, `freeSpinTrigger`/`End`, and `finalWin` (win-cap stinger).
Respect autoplay/mute state and browser audio-unlock requirements (start audio on first user
gesture).

---

## 8. Assets & CDN strategy

- The game runs inside the **Stake CDN iframe**; `vite.config.ts` sets `base: "./"` so the bundle is
  path-independent.
- Pack symbol art into texture atlases; prefer sprite sheets over many individual images.
- Stream/lazy-load non-critical assets; keep the initial payload small for fast first paint.
- Audio sprites (single file + offsets) reduce request count.

---

## 9. Performance budget

- **60 FPS** target; `FRAME_BUDGET_MS = 1000/60 ≈ 16.7ms` per frame (from `gameConfig.ts`).
- Avoid per-frame allocations in the render loop; pool sprites and reuse tickers.
- Dispose Pixi resources on scene teardown to prevent leaks across long autoplay runs.
- `vite.config.ts` enables source maps and a 1500 kB chunk-size warning limit; review chunks before
  release.

---

## 10. Testing

- **Vitest** (jsdom) covers `core/` and `config/` (coverage scoped to `src/core/**`, `src/config/**`
  in `vite.config.ts`). Test the interpreter against real generated books and assert state
  transitions per event.
- **svelte-check + tsc** for types; **ESLint** with `--max-warnings 0`; **Storybook** for component
  development in isolation.
- CI runs `check` + `test` + `build` on every push (see `.github/workflows/ci.yml`).
