# Asset specification — art & audio

Everything a designer needs to replace the **placeholder** art/audio with final
assets. The pipeline is already live (`config/assets.ts` + `core/assetLoader.ts`
for textures, `core/sound.ts` for audio), so most of this is a **drop-in file
swap** — no code changes for anything marked _wired_.

## How assets plug in (read first)

- **Where files live:** bundle-served assets go under `frontend/public/…` and
  ship at the site root (`/symbols/…`, `/audio/…`). For CDN delivery instead,
  set `VITE_ASSET_BASE` (+ `VITE_ASSET_VERSION` for cache-busting) and host the
  same paths there — the code resolves both via `assetUrl()`.
- **Stable keys:** the renderer asks for art by key (`symbol:<id>`) and audio by
  name (`spin`, `win`, …). Keep the **keys/filenames** and a swap needs no code.
- **Graceful fallback:** any symbol with no texture renders the procedural tile;
  any sound with no clip silently no-ops. You can deliver assets incrementally.
- **Guards (CI):** `assets.test.ts` and `sound.test.ts` fail the build if a
  declared asset is missing under `public/`; `e2e/assets.spec.ts` asserts every
  symbol texture loads and every audio clip is served. So a typo or missing file
  is caught automatically.
- **Shared vs per-game:** all three games (NovaForged · lines, Cosmic Ways ·
  ways, Stellar Clusters · cluster) currently **share one symbol set** (same
  ids, same neon-cosmic theme). See _Per-game art_ below to give each title its
  own look.
- **Design resolution:** the scene is laid out against **1280×800**; a symbol
  tile renders at **132×132 px** on a 5×3 grid. Deliver at 2× for crispness.

---

## 1. Symbols — REQUIRED, wired now

11 tiles, one per symbol id. Replace the files in `frontend/public/symbols/`;
keep the names. Placeholders today are SVG (`scripts/gen-placeholder-art.mjs`).

| Key (manifest) | File                    | Depicts (name) | Accent  | Kind    | Notes                                                  |
| -------------- | ----------------------- | -------------- | ------- | ------- | ------------------------------------------------------ |
| `symbol:W`     | `public/symbols/W.svg`  | Aether Crystal | #7df9ff | wild    | Substitutes for all pays; reads as premium/iconic.     |
| `symbol:S`     | `public/symbols/S.svg`  | Nova Sigil     | #ff45e0 | scatter | Triggers free spins; should pop against any reel cell. |
| `symbol:H1`    | `public/symbols/H1.svg` | Nova Core      | #ffd166 | high    | Top high-pay.                                          |
| `symbol:H2`    | `public/symbols/H2.svg` | Starforge      | #ff7b54 | high    |                                                        |
| `symbol:H3`    | `public/symbols/H3.svg` | Pulsar         | #b388ff | high    |                                                        |
| `symbol:H4`    | `public/symbols/H4.svg` | Comet          | #4dd0e1 | high    |                                                        |
| `symbol:L1`    | `public/symbols/L1.svg` | Cyan Shard     | #26c6da | low     | Low-pays read as gem/rune; keep them visually quieter. |
| `symbol:L2`    | `public/symbols/L2.svg` | Violet Shard   | #7e57c2 | low     |                                                        |
| `symbol:L3`    | `public/symbols/L3.svg` | Amber Shard    | #ffb300 | low     |                                                        |
| `symbol:L4`    | `public/symbols/L4.svg` | Rose Shard     | #ec407a | low     |                                                        |
| `symbol:L5`    | `public/symbols/L5.svg` | Lime Shard     | #9ccc65 | low     |                                                        |

**Per-symbol spec**

- **Format:** SVG (preferred — resolution-independent) _or_ WebP/PNG at **512×512**
  (≥ 264×264 minimum for 2× of the 132 px tile).
- **Canvas:** square, transparent or self-contained tile; art should sit within a
  ~10% safe margin (the board adds its own cell spacing of 8 px).
- **Readability:** distinct silhouette per symbol at 132 px; highs visually richer
  than lows; wild and scatter the most distinctive (players track them).
- **Theme:** neon-cosmic — luminous edges/glow on dark, using each symbol's accent
  color as the dominant hue so wins read at a glance.

> The procedural glyph letter is auto-hidden once a symbol texture loads, so your
> art is the whole tile — no letter overlay to design around.

### Per-game art (optional — needs a 1-line keying change)

To give each title its own symbols, namespace the keys/files by game
(`symbol:<game>:<id>` → `symbols/<game>/<id>.svg`) and have `ReelEngine` query
the active game id. Themes to target: **NovaForged** neon-cosmic (lines),
**Cosmic Ways** ways-cosmic (brighter/expansive), **Stellar Clusters**
cluster-cosmic (gem/constellation). Tell us if you want this and we'll wire the
game-aware key (small change in `config/assets.ts` + `ReelEngine.symbolTexture`).

---

## 2. Audio — wired now

7 SFX in `frontend/public/audio/`. Replace the files; keep the names.
Placeholders today are synthesized WAVs (`scripts/gen-placeholder-audio.mjs`).

| Sound name      | File                             | Plays when…                        | Suggested character            | Length    |
| --------------- | -------------------------------- | ---------------------------------- | ------------------------------ | --------- |
| `spin`          | `public/audio/spin.wav`          | the reels start spinning           | rising whoosh / energise       | 0.3–0.6 s |
| `reelStop`      | `public/audio/reelStop.wav`      | each reel lands (fires per reel)   | short tactile thunk; not harsh | ≤ 0.15 s  |
| `win`           | `public/audio/win.wav`           | a standard (small) win resolves    | bright, pleasant chime         | 0.3–0.6 s |
| `bigWin`        | `public/audio/bigWin.wav`        | a big/mega win resolves            | celebratory rising fanfare     | 0.6–1.2 s |
| `scatter`       | `public/audio/scatter.wav`       | scatters land (reserved/available) | sparkly shimmer / magical      | 0.4–0.8 s |
| `freeSpinStart` | `public/audio/freeSpinStart.wav` | free spins are entered             | hopeful rising fanfare         | 0.6–1.0 s |
| `buttonClick`   | `public/audio/buttonClick.wav`   | any UI button (spin, bet ±, etc.)  | crisp, subtle UI blip          | ≤ 0.1 s   |

**Audio spec**

- **Format:** WAV works; for production prefer `webm` (Opus) **+** `mp3` fallback
  (list both in `SOUND_SOURCES[name]` — Howler picks the first it can play).
- **Loudness:** normalize to a consistent perceived level; `reelStop`/`buttonClick`
  noticeably quieter than wins. Peak ≤ −1 dBFS, no clipping; smooth fades to avoid
  clicks.
- **Mono** is fine for SFX; keep files small (these load at boot).
- Sounds with no file simply don't play, so you can add these one at a time.

---

## 3. Recommended additions — NOT wired yet (each needs a small hook)

These aren't required for the game to run (it's fully playable on procedural
visuals today), but they're what turns it from "engine demo" into a finished
title. Each needs a small, well-scoped code change we can do when the art exists
— ask and we'll wire whichever you want.

| Asset                         | Suggested file(s)                                            | Format / size                  | Description & where it lands                                                                                |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Background plate**          | `public/bg/<theme>.webp` (+ optional layers)                 | WebP, **2560×1600** (2×)       | Replaces the procedural nebula in `scenes/Background.ts`. One per theme; can be a still or parallax layers. |
| **Board frame / housing**     | `public/ui/reel-frame.webp` (9-slice ok)                     | WebP/PNG, transparent          | The decorative frame around the 5×3 board (`ReelEngine` draws a plain neon frame today).                    |
| **Game logo / wordmark**      | `public/brand/<game>-logo.webp`                              | WebP/PNG, transparent, ~1200 w | For the loading screen and/or header; one per title.                                                        |
| **Loading screen**            | `public/brand/loading-bg.webp`                               | WebP, 2560×1600                | Shown during boot (currently a CSS color + spinner).                                                        |
| **Win-line / shape overlays** | `public/fx/line-glow.webp`, `public/fx/cluster-glow.webp`    | WebP, transparent              | Highlight art for winning paylines (NovaForged), ways, and cluster blobs (currently drawn as glow strokes). |
| **Big-win celebration**       | `public/fx/burst.webp` (+ sprite sheet)                      | WebP/PNG or sprite atlas       | Coin/star burst for big/mega/wincap tiers (today a procedural particle burst in `scenes/Particles.ts`).     |
| **Free-spins intro card**     | `public/fx/freespins-card.webp`                              | WebP, transparent              | Full-screen "Free Spins!" splash when the feature triggers.                                                 |
| **Symbol win animations**     | `public/symbols/anim/<id>.json` (+ atlas)                    | Spine/Lottie or sprite sheet   | Optional per-symbol win animation; needs an animation runtime hook.                                         |
| **UI button skins**           | `public/ui/btn-spin.webp`, `btn-buybonus.webp`, …            | WebP, transparent              | The HUD is DOM/CSS today; skinning buttons needs CSS background swaps (no engine change).                   |
| **App icon / favicon**        | `public/favicon.svg`, `public/icon-192.png`, `icon-512.png`  | SVG + PNG                      | Replaces the placeholder `favicon.svg`; PNGs for PWA/home-screen.                                           |
| **Ambient music**             | `public/audio/music/base-loop.webm`, `freespins-loop.webm`   | webm+mp3, seamless loop        | Background music for base and free-spin modes; needs a small loop manager in `sound.ts`.                    |
| **Extra SFX**                 | `public/audio/anticipation.*`, `coinTick.*`, `scatterLand.*` | webm+mp3                       | Anticipation riser (near-miss scatter), win-count ticking, per-scatter land — new `SoundName`s + triggers.  |

---

## 4. Delivery checklist

- **Color:** sRGB; design for a **dark** stage (background is near-black `#05010f`).
- **Transparency:** symbols/overlays/frames on transparent backgrounds (PNG/WebP
  alpha or SVG).
- **Resolution:** author at 2× the on-screen size; symbols ideally vector (SVG).
- **Naming:** exactly match the keys/filenames in §1–§2 for a zero-code swap;
  for additions in §3 we'll confirm the final names when we wire them.
- **Weight:** symbols + UI load at boot — keep each symbol ≲ 60 KB (WebP) and the
  background ≲ 400 KB; music can stream. There's a bundle-size budget in CI.
- **Audio:** provide `webm` + `mp3` for each clip if possible; consistent loudness;
  no clipping; trimmed silence.

## 5. How to drop assets in

1. Replace the file(s) under `frontend/public/…` (same path/name as §1–§2).
2. Run `pnpm --filter @aetherspin/frontend test` — the missing-asset guards and
   key checks confirm everything resolves.
3. `pnpm --filter @aetherspin/frontend build && pnpm --filter @aetherspin/frontend preview`
   to see them in the running game; the `e2e/assets.spec.ts` check verifies they
   load/serve in CI.
4. For anything in §3, tell us which and we'll add the (small) code hook in the
   same PR as the art.
