# AetherSpin — Repository Context Pack

> **Purpose of this file:** a single, self-contained briefing you can paste into
> an AI model (or share with a new engineer) that has **no access** to the
> repository. It summarizes what AetherSpin is, how it is structured, the key
> contracts, the current state, and the known gaps. Everything here is accurate
> as of the latest commit; if code and this doc ever disagree, the code wins.

---

## 1. What this is

**AetherSpin** is a production-grade **Stake Engine game-studio monorepo** — a
reusable, future-proof starter kit for building and publishing premium online
slot games on the **Stake Engine** RGS (Remote Gaming Server) platform. It ships
with a complete flagship game, **NovaForged**, a 5×3, 20-line neon-cosmic video
slot.

The core idea: a **single source of truth** (`game-definition.json`) drives
**both** the server-side math (Python) and the client (TypeScript/Svelte/PixiJS),
so the two halves can never silently disagree about paytables, symbols, bet
levels, or features.

**Two audiences for the kit:**

1. A studio that wants a clean foundation to ship many certified Stake Engine
   titles.
2. The flagship NovaForged game itself, demonstrating best practices end-to-end.

---

## 2. Tech stack & requirements

| Layer         | Technology                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                                                                 |
| Math (server) | Python 3.11+ — stdlib-only standalone simulator **and** official StakeEngine/math-sdk-compatible game files |
| Frontend      | TypeScript (strict), Vite 6, Svelte 5, PixiJS v8, Howler (audio)                                            |
| Shared        | TypeScript types + JSON Schema + a Python loader, plus the game definitions                                 |
| Tests         | Vitest (TS), pytest (Python), Storybook (component stories)                                                 |
| Tooling       | Prettier, ESLint, Ruff (Python), svelte-check, TypeScript 6                                                 |
| CI/CD         | GitHub Actions (math + frontend + lint, nightly RTP, tag-based release)                                     |

**Runtime requirements:** Node 20+, pnpm 10+, Python 3.11+.

---

## 3. Repository structure

```
AetherSpin/
├── README.md                  # Project front door (quickstart, architecture, submission)
├── CLAUDE.md                  # Guidance for AI assistants / devs working in the repo
├── SECURITY.md                # RGS security model: "the client never decides outcomes"
├── LICENSE                    # MIT
├── package.json               # Root scripts + pnpm workspaces (frontend, shared)
├── pnpm-workspace.yaml, turbo.json
│
├── shared/                    # SINGLE SOURCE OF TRUTH (consumed by math AND frontend)
│   ├── games/
│   │   ├── novaforged/game-definition.json   # The flagship game's full spec
│   │   └── template/game-definition.json     # Generic starting point for new games
│   ├── schemas/game-definition.schema.json   # JSON Schema (draft-07) for the above
│   ├── src/
│   │   ├── types/game.ts      # GameDefinition TS types (mirror the schema)
│   │   ├── types/events.ts    # BookEvent union — the math→frontend event contract
│   │   ├── index.ts           # Browser-safe barrel: types + amount helpers/constants
│   │   ├── node.ts            # Node-only barrel: filesystem loaders
│   │   └── loadDefinition.ts  # loadGameDefinition() / listGameIds()
│   └── python/aetherspin_shared.py   # Python-side loader + constants (mirrors index.ts)
│
├── math/                      # Server-side, certifiable game math
│   ├── simulator/             # STANDALONE engine (stdlib only — no install needed)
│   │   ├── definition.py      # Typed loader over game-definition.json
│   │   ├── engine.py          # LinesEngine: board/line/scatter eval, free spins, features
│   │   ├── reels.py           # Reel-strip loading + weighted stop sampling
│   │   ├── rng.py             # Seedable RNG (reproducible; single choke point)
│   │   ├── runner.py          # Runs N sims/mode, measures RTP, collects books
│   │   └── library.py         # Writes RGS-compatible books/lookup tables/index/config
│   ├── games/
│   │   ├── novaforged/        # Official math-sdk-compatible game files + reels/*.csv
│   │   │   ├── game_config.py, gamestate.py, game_executables.py,
│   │   │   ├── game_calculations.py, game_events.py, game_override.py,
│   │   │   ├── game_optimization.py, run.py, run_config.toml
│   │   │   └── reels/BR0.csv (base), FR0.csv (free)
│   │   └── template/README.md
│   ├── scripts/               # CLI tools (see §6)
│   │   ├── simulate.py, validate_rtp.py, optimize.py,
│   │   └── generate_books.py, generate_par_sheet.py
│   ├── tests/test_engine.py   # 7 pytest unit tests
│   ├── pyproject.toml         # pytest + ruff config
│   └── requirements.txt       # Optional analysis/test deps (engine itself is stdlib-only)
│
├── frontend/                  # High-end game client (Vite + Svelte + PixiJS + TS)
│   ├── src/
│   │   ├── core/              # Pure logic — NO Pixi/Svelte imports
│   │   │   ├── rgsClient.ts   # Stake Engine RGS API wrapper (authenticate/play/end-round)
│   │   │   ├── mockRgs.ts     # In-browser mock RGS — game is fully playable offline
│   │   │   ├── bookPlayer.ts  # Replays a book's events → stores/event bus → visuals
│   │   │   ├── gameState.ts   # Svelte stores (balance, bet, win, free spins, autoplay…)
│   │   │   ├── eventBus.ts    # Tiny typed pub/sub (core → scenes)
│   │   │   ├── amount.ts      # Currency/amount conversion helpers
│   │   │   └── sound.ts       # Howler-based sound manager (assets optional)
│   │   ├── scenes/            # PixiJS rendering only
│   │   │   ├── Stage.ts       # PIXI app, responsive resize, RAF loop, FPS monitor
│   │   │   ├── ReelEngine.ts  # 5×3 reels, spin, anticipation, win lines, wild FX
│   │   │   ├── Background.ts  # Procedural neon-cosmic backdrop
│   │   │   └── Particles.ts   # Win-celebration particles
│   │   ├── components/        # Svelte UI overlay (11 components + 3 .stories.ts)
│   │   │   └── App, BalanceDisplay, BetSelector, SpinButton, WinDisplay,
│   │   │       Autoplay, PaytableModal, BuyBonusButton, FreeSpinsBanner,
│   │   │       SoundToggle, LoadingScreen
│   │   ├── config/            # gameConfig.ts (typed access to the definition), assets.ts
│   │   └── styles/global.css
│   ├── .storybook/            # Storybook v8 config
│   └── package.json, vite.config.ts, svelte.config.js, tsconfig.json, index.html
│
├── docs/                      # See §8 (architecture, math, frontend, ADRs, templates…)
├── scripts/                   # setup-math.sh, new-game.sh, package-for-stake.sh, build-all.sh
└── .github/                   # 3 workflows + Dependabot + PR/issue templates + CODEOWNERS
```

---

## 4. The single source of truth: `game-definition.json`

One JSON file per game under `shared/games/<id>/`. It is validated by
`shared/schemas/game-definition.schema.json`, typed by `shared/src/types/game.ts`,
read by the Python engine (`math/simulator/definition.py`) and imported directly
by the frontend. **All paytable/symbol/feature numbers live here only** — never
hardcoded in either side.

**Top-level fields:** `id`, `displayName`, `version`, `studio`, `theme`,
`description`, `engine`, `currency`, `bet`, `betModes`, `symbols`, `paytable`,
`paylines`, `scatter`, `features`.

**NovaForged's actual values (the flagship):**

- **engine**: `type: "lines"`, `numReels: 5`, `numRows: 3`,
  `wincapMultiplier: 5000`, `rtpTarget: 0.965`, `volatility: "high"`.
- **currency**: `apiAmountMultiplier: 1_000_000` (dollars→integer API amount),
  `bookAmountMultiplier: 100` (multiplier→integer book payout units).
- **bet**: 10 levels (0.1 → 100.0), default index 2.
- **betModes**: `base` (cost 1.0) and `bonus` (cost 100.0, `isBuyBonus: true`).
- **symbols** (11): `W` wild (multiplier wild), `S` scatter, `H1–H4` high,
  `L1–L5` low; each has id/name/kind/color, wild lists `substitutes`.
- **paytable**: per-symbol payouts for 3/4/5 of a kind (line-bet multiples).
- **paylines**: 20 lines, each an array of row indices per reel, e.g. `[1,1,1,1,1]`.
- **scatter**: symbol `S`, `minToTrigger: 3`, pays for 3/4/5.
- **features**:
  - `freeSpins`: awards `{3:8, 4:12, 5:20}`, retrigger on, `winScale` (an RTP
    balancing knob applied to free-spin wins only), and a `multiplierLadder`
    (global multiplier x1 → x3, +1 on each winning free spin).
  - `multiplierWilds`: values `[2,3,5]` weighted `[60,30,10]`, applies in free spins.
  - `expandingWilds`: in free spins, wilds on the middle reels expand to full reels.
  - `bonusBuy`: buy the free-spins feature for 100× the bet (the `bonus` mode).

---

## 5. The math engine

There are **two interchangeable paths** sharing the same definition:

1. **Standalone simulator (`math/simulator/`)** — pure Python standard library,
   no install. Used for local dev, CI, RTP reporting, and generating
   RGS-compatible output. Fast and hermetic.
2. **Official `StakeEngine/math-sdk` path (`math/games/<id>/`)** — the certified
   route for final submission, including the SDK's Rust optimizer. Fetched via
   `bash scripts/setup-math.sh` (clones the SDK into `math/engine/`, git-ignored).

**How a round is simulated (lines game):** draw a board from weighted reel
strips → evaluate all paylines left-to-right with wild substitution → evaluate
scatters (pays + free-spin trigger) → if triggered, run free spins (escalating
global multiplier, multiplier wilds, expanding wilds, retriggers) → clamp to the
win cap → emit an ordered list of **book events** and a `payoutMultiplier`.

**RTP tuning uses two decoupled knobs** so the buy-bonus is balanced
independently and is never EV-positive for the player:

1. a global **paytable scalar**, and
2. `features.freeSpins.winScale` (free-spin wins only).
   `math/scripts/optimize.py` solves both to hit the base-game and buy-bonus RTP
   targets simultaneously.

**Measured RTP (standalone engine, high-variance title):** base ≈ **94.9%**
(target 96.5%; the official SDK's optimizer tightens this for certification over
millions of spins), buy-bonus ≈ **96.5%**, hit rate ≈ 32%, free-spins ≈ 1 in 137,
5000× cap.

**Library output** (`math/library/<id>/`, git-ignored; regenerate with
`generate_books.py`) — the files uploaded to the RGS:

```
books/books_<mode>.jsonl                      # one JSON "book" per line (per bet mode)
lookup_tables/lookUpTable_<mode>.csv          # id, weight, payout (book units)
lookup_tables/lookUpTableIdToCriteria_<mode>.csv
configs/config.json                           # RGS math config (modes, costs, measured RTP)
index.json                                    # manifest of modes → files
```

A **book** is one simulated round: `{ "id": <int>, "payoutMultiplier": <float>,
"events": [ ... ] }`.

---

## 6. The math↔frontend contract: book events

The math emits events; the frontend (`bookPlayer.ts`) replays them in order to
drive visuals. The contract is the `BookEvent` union in
`shared/src/types/events.ts`. Event `type`s:

| Event               | Meaning                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `reveal`            | A board is shown (base or free); carries `board`, `reelStops`, and in free spins `spin`/`spinsTotal`/`globalMultiplier`/`expandedReels`. |
| `lineWins`          | Winning paylines for the current board + total amount.                                                                                   |
| `scatterWin`        | Scatter pay (count + amount).                                                                                                            |
| `freeSpinTrigger`   | Free spins awarded (scatters, count, start multiplier).                                                                                  |
| `freeSpinResult`    | Per-free-spin result (wins, scatter, global multiplier, amount).                                                                         |
| `ladderStep`        | The global multiplier advanced.                                                                                                          |
| `freeSpinRetrigger` | Extra free spins awarded mid-feature.                                                                                                    |
| `freeSpinEnd`       | Free spins finished (total win).                                                                                                         |
| `finalWin`          | Round settled (amount, whether the win cap was hit).                                                                                     |

Amount conventions (shared, in `index.ts`): **API amount = dollars × 1,000,000**
(integers on the wire); **book payout units = multiplier × 100**.

---

## 7. Frontend & RGS integration

**Clean separation:** `core/` (logic, no Pixi/Svelte) talks to `scenes/` (Pixi
only) via a typed event bus, and to `components/` (Svelte only) via stores.

**RGS flow (production):** on load, `authenticate` (session/RGS URL/currency/lang
come from URL query params Stake injects into the iframe) → `play({ amount, mode })`
returns the round + book → `bookPlayer` replays the book → `end-round` settles.
Endpoints: `POST /wallet/authenticate`, `/wallet/play`, `/wallet/end-round`,
`/wallet/balance`, `/bet/event`. Status codes handled include `SUCCESS`,
`ERR_IPB` (insufficient balance), `ERR_IS` (invalid session), `ERR_ATE` (auth
expired).

**Local dev:** `mockRgs.ts` generates definition-conformant books (or replays
real `*.jsonl` books if dropped into `src/assets/books/`), so the game is fully
playable with **no backend** and **no art assets** (graphics are procedural).

**Security model (see `SECURITY.md`):** the client **never** decides outcomes;
all RNG/payouts are server-side and the client only replays the committed result.

---

## 8. CI/CD, docs, scripts

**GitHub Actions (`.github/workflows/`):**

- `ci.yml` (push + PR): math (pytest + RTP gate at 150k sims, ±5%), frontend
  (svelte-check + tsc, Vitest, Vite build), lint (Prettier + ESLint).
- `math-validation.yml` (nightly + manual): deep RTP (1M sims, ±3%) + PAR-sheet
  artifact.
- `release.yml` (tag `v*`): builds the Stake upload bundle and attaches the zip.
- Dependabot (npm/pip/actions), PR + issue templates, CODEOWNERS.

**Docs (`docs/`):** `architecture.md`, `math-engine.md`, `frontend.md`,
`developing-a-new-game.md`, `stake-engine-submission-checklist.md`,
`novaforged-design.md`, 4 ADRs (`adr/0001–0004`), and templates
(`game-design-document.md`, `par-sheet-template.md`).

**Scripts (`scripts/`):**

- `setup-math.sh` — clone the official math-sdk into `math/engine/`.
- `new-game.sh <id>` — scaffold a new title (definition + math game files + reels).
- `package-for-stake.sh [id]` — build the dashboard upload bundle
  (`dist-stake/<id>/` = math library + frontend `dist/` + manifest, zipped).
- `build-all.sh` — validate RTP → generate books → build frontend.

**Common commands:**

```bash
python math/scripts/simulate.py --game novaforged --sims 100000      # RTP + stats
python math/scripts/validate_rtp.py --game novaforged --sims 200000  # gate RTP
python math/scripts/optimize.py --game novaforged --apply            # auto-tune RTP
python math/scripts/generate_books.py --game novaforged              # RGS library
python -m pytest math/tests                                          # math tests
pnpm install && pnpm --filter @aetherspin/frontend dev               # play locally
pnpm --filter @aetherspin/frontend test                              # frontend tests
bash scripts/package-for-stake.sh novaforged                         # upload bundle
```

---

## 9. Current state (metrics)

- **Games:** 1 complete (NovaForged) + 1 template.
- **Tests:** math 7 (pytest); frontend ~34 (Vitest, 6 core test files); shared 3.
- **CI:** all green on the latest commit (math + frontend + lint).
- **Docs:** ~1,450 lines across guides, ADRs, templates, and the submission checklist.
- **Branches:** work lands on `claude/stake-engine-monorepo-setup-2b2chu`; a
  `main` mirror exists.

---

## 10. Known gaps / absences (honest list)

Present-but-not-yet-there, useful when asking a model "what would make this the
ultimate Stake Engine starter kit":

- **Testing:** no end-to-end tests (Playwright/Cypress), no property-based math
  tests (hypothesis), no visual-regression, no committed PAR sheet.
- **Contract safety:** the JSON schema is **not** validated in CI; no golden-book
  snapshot/parity test guaranteeing math output matches the `BookEvent` types.
- **Math typing:** Python code has no type hints; mypy not configured.
- **CI/CD:** no coverage upload, no CodeQL/secret-scanning/dependency-review, no
  Storybook/docs-site deploy, manual (tag-based) releases.
- **Frontend depth:** no i18n/localization, limited accessibility (a few
  aria-labels), no error boundary, no analytics/telemetry hooks, no PWA, real
  art/audio assets not yet integrated (procedural placeholders only).
- **Compliance:** no responsible-gaming features (session/loss/time limits,
  reality checks).
- **Repo hygiene:** no `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`,
  `.env.example`, pre-commit hooks, devcontainer/Docker.
- **Reusability proof:** only one example game type (lines); no "ways"/"cluster"
  title yet to demonstrate the engine generalizes.

---

## 11. Glossary

- **RGS** — Remote Gaming Server; the certified backend that owns RNG, balance,
  and payouts.
- **Book** — one fully-simulated round (id + payoutMultiplier + ordered events).
- **Lookup table** — weighted index mapping book ids to payouts; the RGS samples it.
- **Bet mode** — a way to play (`base`, or `bonus` = buy the feature).
- **Win cap** — maximum payout as a multiple of the bet (NovaForged: 5000×).
- **RTP** — Return To Player (target 96.5%).
- **PAR sheet** — Probability Accounting Report; the math documentation submitted
  for certification.
