# Artwork checklist

Condensed, prioritized list of art/audio needed to finish the titles. Full specs
(sizes, formats, themes, where each lands) are in
[`docs/asset-spec.md`](asset-spec.md). The game is fully playable on procedural
placeholders today; these replace them.

Design target: scene **1280×800**, symbol tile **132×132** on a 5×3 grid; deliver
art at 2× (symbols ≥ 512×512). Keep the **filenames/keys** and the required set is
a drop-in swap (no code change).

## REQUIRED (wired now — drop-in swap)

### Symbols — 11 tiles → `frontend/public/symbols/<id>.svg` (or WebP/PNG 512²)

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

### Audio — 7 SFX → `frontend/public/audio/<name>.wav` (prod: webm+mp3)

- [ ] `spin` — rising whoosh (0.3–0.6 s)
- [ ] `reelStop` — short tactile thunk, per reel (≤ 0.15 s)
- [ ] `win` — bright chime, small win (0.3–0.6 s)
- [ ] `bigWin` — celebratory fanfare (0.6–1.2 s)
- [ ] `scatter` — sparkly shimmer (0.4–0.8 s)
- [ ] `freeSpinStart` — hopeful rising fanfare (0.6–1.0 s)
- [ ] `buttonClick` — crisp UI blip (≤ 0.1 s)

## RECOMMENDED (turns demo → finished title; each needs a small code hook)

- [ ] **Background plate** per theme → `public/bg/<theme>.webp` (2560×1600)
- [ ] **Board frame / housing** → `public/ui/reel-frame.webp`
- [ ] **Game logo / wordmark** per title → `public/brand/<game>-logo.webp`
- [ ] **Loading screen** → `public/brand/loading-bg.webp`
- [ ] **Win/shape overlays** → `public/fx/line-glow.webp`, `cluster-glow.webp`
- [ ] **Big-win burst** → `public/fx/burst.webp` (+ sprite sheet)
- [ ] **Free-spins intro card** → `public/fx/freespins-card.webp`
- [ ] **UI button skins** → `public/ui/btn-*.webp`
- [ ] **App icon / favicon** → `public/favicon.svg`, `icon-192.png`, `icon-512.png`
- [ ] _(Optional)_ **Per-symbol win animations** → Spine/Lottie/atlas

## Per-game theming (optional)

All three games currently share one neon-cosmic symbol set. To give each its own
look — NovaForged (lines, neon-cosmic), Cosmic Ways (ways, brighter/expansive),
Stellar Clusters (cluster, gem/constellation) — namespace keys/files per game
(`symbols/<game>/<id>`); it's a ~1-line keying change we wire on request.

## Guarantees

- Missing texture → procedural tile; missing sound → silent no-op. **Deliver
  incrementally.**
- CI guards (`assets.test.ts`, `sound.test.ts`, `e2e/assets.spec.ts`) fail the
  build on a missing/typo'd declared asset, so nothing ships half-wired.
