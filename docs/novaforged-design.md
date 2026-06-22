# Game Design Document — NovaForged

The flagship AetherSpin title and the fully worked reference for this monorepo. All numbers below
are taken from the single source of truth, `shared/games/novaforged/game-definition.json`.

|                  |                                                                     |
| ---------------- | ------------------------------------------------------------------- |
| **Game id**      | `novaforged`                                                        |
| **Display name** | NovaForged                                                          |
| **Version**      | 1.0.0                                                               |
| **Studio**       | AetherSpin                                                          |
| **Theme**        | neon-cosmic                                                         |
| **Status**       | Math complete & RTP-validated (standalone); frontend in development |

> _A premium 5×3, 20-line neon-cosmic video slot featuring multiplier wilds, scatter-triggered free
> spins with an escalating multiplier ladder, expanding wilds, and a bonus buy._

---

## 1. Theme & concept

- **Theme:** neon-cosmic — a forge at the heart of a nebula where stars are hammered into being.
- **Pitch:** chase the Nova Sigils into the free-spin forge, where wilds expand and a rising
  multiplier ladder superheats every win.
- **Tone:** electric, premium, high-stakes; saturated neon against deep space.

## 2. Math model

| Property    | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Engine type | `lines`                                                           |
| Grid        | 5 reels × 3 rows                                                  |
| Paylines    | **20** (fixed)                                                    |
| RTP target  | **96.5%**                                                         |
| Volatility  | **high**                                                          |
| Win cap     | **5000×**                                                         |
| Bet levels  | $0.10 – $100.00 (10 levels; default $0.50)                        |
| Bet modes   | `base` (1.0×), `bonus` / buy free spins (100×)                    |
| Currency    | USD; API unit = dollars × 1,000,000; book unit = multiplier × 100 |

### Measured (standalone engine, ~120k spins)

| Metric              | Base                                      | Bonus (buy)                             |
| ------------------- | ----------------------------------------- | --------------------------------------- |
| RTP                 | ≈ 96.5% target (≈94.9–97% by seed/sample) | ≈ 96.5%, measured against the 100× cost |
| Hit rate            | ≈ 32%                                     | 100% (always enters free spins)         |
| Free-spin frequency | ≈ 1 in ~130                               | n/a                                     |
| Win cap             | enforced at 5000×                         | enforced at 5000×                       |

> Standalone figures are seed-/sample-dependent engineering estimates that gate CI; **certified**
> figures come from the official math-sdk (millions of spins + Rust optimizer, which tightens the
> base RTP to target). See [math-engine.md](math-engine.md).

## 3. Symbols

| Id  | Name                  | Kind    | Color     |
| --- | --------------------- | ------- | --------- |
| W   | Aether Crystal (Wild) | wild    | `#7df9ff` |
| S   | Nova Sigil (Scatter)  | scatter | `#ff45e0` |
| H1  | Nova Core             | high    | `#ffd166` |
| H2  | Starforge             | high    | `#ff7b54` |
| H3  | Pulsar                | high    | `#b388ff` |
| H4  | Comet                 | high    | `#4dd0e1` |
| L1  | Cyan Shard            | low     | `#26c6da` |
| L2  | Violet Shard          | low     | `#7e57c2` |
| L3  | Amber Shard           | low     | `#ffb300` |
| L4  | Rose Shard            | low     | `#ec407a` |
| L5  | Lime Shard            | low     | `#9ccc65` |

The **Wild (W)** substitutes for all paying symbols (H1–H4, L1–L5). The **Scatter (S)** pays anywhere
and triggers free spins.

## 4. Paytable

Per-line multipliers for 3 / 4 / 5 of a kind:

| Symbol          | 3   | 4   | 5    |
| --------------- | --- | --- | ---- |
| W (Wild)        | 45  | 225 | 1115 |
| H1 Nova Core    | 33  | 175 | 885  |
| H2 Starforge    | 26  | 135 | 560  |
| H3 Pulsar       | 22  | 90  | 405  |
| H4 Comet        | 18  | 66  | 270  |
| L1 Cyan Shard   | 8.9 | 33  | 160  |
| L2 Violet Shard | 8.9 | 33  | 160  |
| L3 Amber Shard  | 5.6 | 22  | 110  |
| L4 Rose Shard   | 5.6 | 22  | 110  |
| L5 Lime Shard   | 4.5 | 18  | 90   |

**Scatter pays (anywhere):** 3 → 2×, 4 → 10×, 5 → 50×.

> Line payouts are divided by the payline count (20) at evaluation so the round total stays a clean
> multiple of the total bet (see [math-engine.md](math-engine.md#3-line-evaluation-with-wild-substitution)).

## 5. Paylines

**20 fixed paylines**, evaluated **left-aligned** with wild substitution. Each line is a `[row,…]`
pattern across the 5 reels (0 = top, 2 = bottom). The set includes the three horizontals, V/Λ and
zig-zag shapes, e.g.:

```
[1,1,1,1,1]  [0,0,0,0,0]  [2,2,2,2,2]   (middle / top / bottom rows)
[0,1,2,1,0]  [2,1,0,1,2]                (V and Λ)
[0,0,1,2,2]  [2,2,1,0,0]  …             (diagonals / zig-zags)
```

(Full list in `game-definition.json` → `paylines`.)

## 6. Features

### Free spins

- **Trigger:** 3+ Nova Sigils (scatters).
- **Awards:** 3 → **8** spins, 4 → **12**, 5 → **20**.
- **Retrigger:** yes — additional scatters during the feature award more spins (same table).
- **Multiplier ladder:** a **global** multiplier starts at **×1**, **steps +1 on any winning free
  spin**, capped at **×3**. Applied to every free-spin win.
- **`winScale`:** `0.297` — the free-spin tuning knob that balances the buy-bonus RTP independently
  of the base game.

### Multiplier wilds (free spins only)

- Values **[2, 3, 5]** with weights **[60, 30, 10]** (expected ≈ 2.6 → rounded factor **3**), applied
  to lines containing a wild, on top of the global ladder multiplier.

### Expanding wilds (free spins only)

- A wild landing on any of the **middle three reels** expands to fill that entire reel with wilds.

### Bonus buy

- Instantly enter free spins for **100× the base bet** (`bonus` mode). Balanced so it is **not**
  player-EV-positive (verified by `test_buy_bonus_not_player_positive`).

## 7. RTP & volatility

- **Target RTP 96.5%**, **high volatility**, **5000× win cap**. Volatility is driven by the reel
  strips (`BR0.csv` base, `FR0.csv` free) plus the free-spin multiplier stack.
- Two-knob tuning (paytable scalar + `winScale`) pins **both** the base and the buy-bonus RTP to
  target; the buy is measured against its 100× cost. See
  [math-engine.md](math-engine.md#6-two-knob-rtp-tuning).
- Distribution: frequent small base wins (~32% hit rate) with rare, high-value free-spin outcomes —
  the signature of a high-volatility title. Generate the full histogram with
  `generate_par_sheet.py`.

## 8. Art direction

- **Palette:** electric cyan (`#7df9ff`), magenta sigil (`#ff45e0`), warm cores (gold/orange) against
  deep-space backdrops; each symbol carries its own neon hue (see §3).
- **Style:** glowing, forged-metal high symbols; faceted gem "shard" lows.
- **Scenes:** base game in the nebula forge; free spins shift to a superheated forge with the
  ladder HUD prominent.
- **VFX:** wild expansion sweep, ladder-step flare, multiplier-wild ignition, big-win and win-cap
  sequences.

## 9. Sound direction

- **Music:** ambient cosmic base loop; intensified forge loop in free spins that rises with the
  ladder.
- **SFX:** reel spin/stop, tiered win stings, scatter trigger, ladder step, expanding-wild whoosh,
  free-spins start/end, win-cap stinger.

## 10. UX

- **Controls:** spin, 10-level bet selector (default $0.50), autoplay with stop, **Buy Free Spins**
  (100×), paytable/rules.
- **HUD:** balance, bet, win display; in free spins, spins remaining and current global multiplier
  (ladder).
- **Performance:** 60 FPS target (`FRAME_BUDGET_MS ≈ 16.7ms`).

## 11. Compliance & responsible gaming

- Paytable/rules screen documents every feature (free spins, multiplier & expanding wilds, ladder,
  bonus buy).
- Responsible-gaming affordances and jurisdictional disclosures per the
  [submission checklist](stake-engine-submission-checklist.md).
- Certification artifacts: PAR sheet (`generate_par_sheet.py`) + RTP validation
  (`validate_rtp.py`).

## 12. Status & references

- **Math:** standalone engine complete and RTP-validated; official-SDK files
  (`math/games/novaforged/`) ready for a certified run via `scripts/setup-math.sh`.
- **Frontend:** in development (core/scenes/components).
- **See also:** [architecture.md](architecture.md), [math-engine.md](math-engine.md),
  [frontend.md](frontend.md), [developing-a-new-game.md](developing-a-new-game.md).
