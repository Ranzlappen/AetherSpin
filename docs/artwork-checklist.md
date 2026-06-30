# Artwork checklist

Condensed, prioritized list of art/audio needed to finish the titles, **with a
target format and size on every item**. Full specs (themes, where each lands, the
plug-in mechanism) are in [`docs/asset-spec.md`](asset-spec.md). The game is fully
playable on procedural placeholders today; these replace them.

## Formats — read first

You are **not limited to SVG.** Textures load through Pixi `Assets.load`, which
picks the parser by file extension, so any of these work for symbols/art:

- **SVG** — preferred for symbols/logos/icons (resolution-independent, tiny).
- **WebP** — preferred for raster art (photographic plates, FX); alpha supported.
- **PNG** — fine where you need lossless alpha (icons, frames).
- **AVIF / JPG** also load; **KTX2/Basis** (GPU-compressed) supported if you ever
  need it. JPG only where alpha isn't needed.

**Sizing rule:** the scene is laid out at **1280×800**; a symbol tile is
**132×132** on a 5×3 grid (8 px gap → board **700×420**). The renderer caps render
resolution at **2×**, so author raster art at **2×** the on-screen size. Vectors
(SVG) are resolution-independent — no size to pick. sRGB; design for a near-black
stage (`#05010f`).

## REQUIRED (wired now — drop-in swap, keep the filenames/keys)

### Symbols — 11 tiles → `frontend/public/symbols/<id>.{svg|webp|png}`

- **Format:** SVG (preferred) _or_ WebP/PNG. **Size:** square; SVG any, raster
  **512×512** (≥ 264×264 = 2× of the 132 px tile). Transparent; art within a ~10%
  safe margin. **Weight:** ≲ 60 KB each (boot-loaded; CI bundle budget).

- [ ] `W` — Aether Crystal (wild, #7df9ff) — most iconic; substitutes all pays
- [ ] `S` — Nova Sigil (scatter, #ff45e0) — must pop; triggers free spins
- [ ] `H1` — Nova Core (high, #ffd166) — top pay
- [ ] `H2` — Starforge (high, #ff7b54)
- [ ] `H3` — Pulsar (high, #b388ff)
- [ ] `H4` — Comet (high, #4dd0e1)
- [ ] `L1` — Cyan Shard (low, #26c6da)
- [ ] `L2` — Violet Shard (low, #7e57c2)
- [ ] `L3` — Amber Shard (low, #ffb300)
- [ ] `L4` — Rose Shard (low, #ec407a)
- [ ] `L5` — Lime Shard (low, #9ccc65)

### Audio — 7 SFX → `frontend/public/audio/<name>.{wav|webm|mp3}`

- **Format:** WAV works; for production prefer **WebM (Opus) + MP3** fallback
  (list both in `SOUND_SOURCES[name]`). Mono OK. Peak ≤ −1 dBFS, no clipping,
  trimmed silence, consistent loudness (UI/reel quieter than wins).

- [ ] `spin` — rising whoosh — **0.3–0.6 s**
- [ ] `reelStop` — short tactile thunk, per reel — **≤ 0.15 s**
- [ ] `win` — bright chime, small win — **0.3–0.6 s**
- [ ] `bigWin` — celebratory fanfare — **0.6–1.2 s**
- [ ] `scatter` — sparkly shimmer — **0.4–0.8 s**
- [ ] `freeSpinStart` — hopeful rising fanfare — **0.6–1.0 s**
- [ ] `buttonClick` — crisp UI blip — **≤ 0.1 s**

## RECOMMENDED (turns demo → finished title; each needs a small code hook)

| Asset                         | File(s)                                                    | Format                 | Target size                                          |
| ----------------------------- | ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| **Background plate**          | `public/bg/<theme>.webp`                                   | WebP                   | **2560×1600** (2× of 1280×800)                       |
| **Board frame / housing**     | `public/ui/reel-frame.{webp\|png}`                         | WebP/PNG, alpha        | wraps board 700×420 → **~1520×960** (2×), or 9-slice |
| **Game logo / wordmark**      | `public/brand/<game>-logo.{webp\|png\|svg}`                | SVG or WebP/PNG, alpha | ~**1200 px** wide (SVG = any)                        |
| **Loading screen**            | `public/brand/loading-bg.webp`                             | WebP                   | **2560×1600**                                        |
| **Win-line / shape overlays** | `public/fx/line-glow.webp`, `public/fx/cluster-glow.webp`  | WebP, alpha            | ~**512×512** tileable/stretchable                    |
| **Big-win burst**             | `public/fx/burst.webp` (+ sprite sheet)                    | WebP/PNG or atlas      | frames **512×512** (sheet ≤ 2048²)                   |
| **Free-spins intro card**     | `public/fx/freespins-card.webp`                            | WebP, alpha            | **2560×1600** (full-screen splash)                   |
| **UI button skins**           | `public/ui/btn-*.{webp\|png}`                              | WebP/PNG, alpha        | ~**256×256** per state (2×)                          |
| **App icon / favicon**        | `public/favicon.svg`, `icon-192.png`, `icon-512.png`       | SVG + PNG              | **192×192** and **512×512**                          |
| **Ambient music**             | `public/audio/music/base-loop.webm`, `freespins-loop.webm` | WebM + MP3             | seamless loop, streamed                              |
| _(Optional)_ symbol win FX    | `public/symbols/anim/<id>.json` (+ atlas)                  | Spine/Lottie/atlas     | matches 132 px tile (author 2×)                      |

## Per-game theming (the seam is built — drop files in)

Each game can ship its own symbol set without code changes: the resolver
(`config/assets.ts` → `symbolAssetPath`) prefers a per-game override and falls
back to the shared set. To theme a title:

1. Drop files under **`frontend/public/games/<game>/symbols/<id>.{svg|webp|png}`**
   (same ids, same size/format targets as the shared symbols above).
2. Add the entries to `THEMED_SYMBOL_SETS` in `config/assets.ts`, e.g.
   `cosmicways: { H1: 'games/cosmicways/symbols/H1.svg', … }`.

Any id you don't override keeps the shared placeholder, so theming is incremental.
Themes to target: **NovaForged** neon-cosmic (lines), **Cosmic Ways**
brighter/expansive (ways), **Stellar Clusters** gem/constellation (cluster).

## Guarantees

- Missing texture → procedural tile; missing sound → silent no-op. **Deliver
  incrementally.**
- CI guards (`assets.test.ts`, `sound.test.ts`, `e2e/assets.spec.ts`) fail the
  build on a missing/typo'd declared asset, so nothing ships half-wired.
