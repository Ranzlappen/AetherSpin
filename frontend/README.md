# @aetherspin/frontend — NovaForged web client

Production web game client for the flagship **NovaForged** slot, part of the
AetherSpin Stake Engine monorepo. Built with **Vite + Svelte 4 + TypeScript
(strict)** and **PixiJS v8** for WebGL reel rendering, targeting 60fps.

The game is **fully playable locally with no backend** thanks to an in-browser
mock RGS that produces `BookEvent`-conformant outcomes from the game definition
(or replays real generated books if you drop them in).

## Quick start

```sh
pnpm install                         # from repo root (workspace)
pnpm --filter @aetherspin/frontend dev
```

Open the printed URL. With no `rgsUrl`/`sessionID` query params present the
client boots the **mock RGS** (a `DEMO` badge + live FPS appears) with a $1,000
demo balance.

### Scripts

| Script           | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                    |
| `pnpm build`     | Production build to `dist/`                        |
| `pnpm preview`   | Preview the production build                       |
| `pnpm test`      | Vitest unit tests (core + config)                  |
| `pnpm check`     | `svelte-check` + `tsc --noEmit` (strict typecheck) |
| `pnpm lint`      | ESLint (TS + Svelte)                               |
| `pnpm storybook` | Component explorer                                 |

## Architecture

Strict separation of concerns; data flows one way (core → stores/bus → UI):

```
src/
  config/
    gameConfig.ts     Typed access to game-definition.json (symbols, paytable,
                      bet levels, format helpers, TARGET_FPS budget)
    assets.ts         Asset base-URL strategy (bundle vs Stake CDN)
  core/               Pure logic — NO Pixi/Svelte-component imports
    rgsClient.ts      Typed Stake Engine RGS wrapper; URL-param parsing; amount
                      conversion via shared helpers; status-code → typed errors
    mockRgs.ts        In-browser RGS; loads real books or generates outcomes
    bookPlayer.ts     Replays a Book's events, drives stores + bus, settles round
    gameState.ts      Svelte stores (balance, bet, win, free spins, autoplay …)
    eventBus.ts       Tiny typed pub/sub between core and scenes
    sound.ts          Howler sound registry (no-ops gracefully without assets)
  scenes/             Pixi-only rendering
    Stage.ts          Application lifecycle, responsive resize, RAF, FPS hook
    ReelEngine.ts     5x3 reels, procedural symbol textures, spin/stop,
                      anticipation, win-lines, expanding wilds, multiplier badges
    Background.ts     Procedural neon starfield / nebula
    Particles.ts      Pooled win-celebration particles
  components/         Svelte-only DOM overlay UI (Stake approval-friendly)
    App.svelte        Root: mounts stage, authenticates, orchestrates spins
    …                 BalanceDisplay, BetSelector, SpinButton, WinDisplay,
                      Autoplay, PaytableModal, BuyBonusButton, FreeSpinsBanner,
                      SoundToggle, LoadingScreen
  styles/global.css   Neon theme, responsive (portrait + landscape)
  main.ts             Mounts App.svelte into #app
```

### The contract (do not diverge)

All game shapes come from the shared package — this client never invents them:

- `shared/games/novaforged/game-definition.json` — symbols, paytable, paylines,
  bet levels, bet modes, features.
- `shared/src/types/events.ts` — the `BookEvent` union the math emits.
- `shared/src/index.ts` — `API_AMOUNT_MULTIPLIER` (1e6), `BOOK_AMOUNT_MULTIPLIER`
  (100), `toApiAmount` / `fromApiAmount`. These are mirrored browser-side in
  `src/core/amount.ts` (with a load-time cross-check against the definition) so
  the bundle never imports the shared package's Node-only `loadDefinition`.

### RGS communication

`rgsClient.ts` implements the official Stake Engine pattern over POST/JSON:
`/wallet/authenticate`, `/wallet/play`, `/wallet/end-round`, `/wallet/balance`,
`/bet/event`. Wire amounts are integers (`dollars * 1_000_000`); the client
converts at the boundary so the rest of the app works in dollars. Non-`SUCCESS`
status codes (`ERR_IPB`, `ERR_IS`, `ERR_ATE`, `ERR_VAL`, `ERR_UE`) map to a typed
`RgsError`. `sessionID`, `rgs_url`, `lang` and `currency` are read from the iframe
URL query params.

A round runs: `play(bet, mode)` → replay the returned `book.events` in order →
`endRound()` to settle.

### Event replay order

`bookPlayer.ts` mirrors the math engine ordering:

```
reveal(base) → lineWins → scatterWin → freeSpinTrigger
  → [ reveal(free) → freeSpinResult → ladderStep | freeSpinRetrigger ]*
  → freeSpinEnd → finalWin
```

## Assets & the Stake CDN

The game ships with **zero required art/audio** — symbols, background and
particles are drawn procedurally with Pixi `Graphics`/`Text`.

To use real assets in production, set the CDN base and the client resolves all
optional assets against it:

```sh
# .env.production
VITE_ASSET_BASE=https://cdn.stake-engine.com/novaforged/v1
```

- **Audio:** drop files in `src/assets/audio/` and register their URLs in
  `SOUND_SOURCES` (`src/core/sound.ts`), e.g.
  `spin: [assetUrl("audio/spin.webm"), assetUrl("audio/spin.mp3")]`. Missing
  files never crash the game.
- **Real books:** drop `*.jsonl` from `math/library/novaforged/books/` into
  `src/assets/books/` to have the mock RGS replay authentic outcomes (see that
  folder's README). Files matching `*bonus*` feed the buy-bonus mode.

`vite.config.ts` sets `base: "./"` so the built bundle works from any path inside
the Stake CDN iframe.

## Testing

Vitest covers the core logic and config:

- `rgsClient` — amount conversion + URL-param parsing + status-code error mapping.
- `mockRgs` — generated books conform to the `BookEvent` union and ordering
  invariants; buy-bonus always triggers; wallet debit/credit.
- `bookPlayer` — base + free-spin state transitions and `endRound` settlement.
- `gameState` — bet stepping, derived stores, free-spins reset.
- `gameConfig` / `eventBus` — definition lookups and pub/sub semantics.

```sh
pnpm --filter @aetherspin/frontend test
```

## Performance

- `TARGET_FPS = 60`; the ticker is capped and an FPS hook surfaces the live rate
  (visible on the demo badge).
- Symbol textures are generated once and cached; particles are pooled.
- `resolution` is clamped to 2 to avoid over-rendering on high-DPI displays.

```

```
