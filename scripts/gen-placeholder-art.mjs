#!/usr/bin/env node
/**
 * Generate neon-cosmic **placeholder** symbol art as SVGs.
 *
 * The frontend renders symbols procedurally by default; this fills the asset
 * pipeline (config/assets.ts + core/assetLoader.ts) with real, themed art so the
 * demo looks designed rather than schematic — and so the pipeline is exercised
 * end-to-end. These are placeholders (vector, programmatic), meant to be
 * replaced by a designer's final art; the manifest keys stay the same, so that
 * swap is a pure file replacement.
 *
 * Output: frontend/public/symbols/<id>.svg (committed). Re-run after edits:
 *     node scripts/gen-placeholder-art.mjs
 *
 * Symbols + colors mirror shared/games/<id>/game-definition.json (all three
 * games share the same symbol ids).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/public/symbols');

/** id → { color, name, icon } — color/name match the game definitions. */
const SYMBOLS = {
  W: { color: '#7df9ff', name: 'Aether Crystal', icon: 'crystal', label: 'WILD' },
  S: { color: '#ff45e0', name: 'Nova Sigil', icon: 'sigil', label: 'SCATTER' },
  H1: { color: '#ffd166', name: 'Nova Core', icon: 'core' },
  H2: { color: '#ff7b54', name: 'Starforge', icon: 'forge' },
  H3: { color: '#b388ff', name: 'Pulsar', icon: 'pulsar' },
  H4: { color: '#4dd0e1', name: 'Comet', icon: 'comet' },
  L1: { color: '#26c6da', name: 'Cyan Shard', icon: 'shard', rank: 'A' },
  L2: { color: '#7e57c2', name: 'Violet Shard', icon: 'shard', rank: 'K' },
  L3: { color: '#ffb300', name: 'Amber Shard', icon: 'shard', rank: 'Q' },
  L4: { color: '#ec407a', name: 'Rose Shard', icon: 'shard', rank: 'J' },
  L5: { color: '#9ccc65', name: 'Lime Shard', icon: 'shard', rank: '10' },
};

const C = 128; // center of a 256x256 canvas

/** Build the icon markup for a symbol, themed to `color`. */
function icon(kind, color, sym) {
  // Attribute helpers, kept separate so a filled shape and an open stroke never
  // emit duplicate `fill`/`stroke-width` attributes.
  const cap = `stroke-linejoin="round" stroke-linecap="round"`;
  const filled = (w = 6) => `fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${w}" ${cap}`;
  const line = (w = 6, op = 1) => `fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" ${cap}`;
  const solid = `fill="${color}"`;
  switch (kind) {
    case 'core': {
      // Glowing core: concentric rings + radiating spokes.
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = (C + Math.cos(a) * 40).toFixed(1);
        const y1 = (C + Math.sin(a) * 40).toFixed(1);
        const x2 = (C + Math.cos(a) * 62).toFixed(1);
        const y2 = (C + Math.sin(a) * 62).toFixed(1);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${line()}/>`;
      }).join('');
      return `<circle cx="${C}" cy="${C}" r="34" ${filled()}/><circle cx="${C}" cy="${C}" r="18" ${solid}/>${rays}`;
    }
    case 'forge': {
      // 8-point starburst.
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const rr = i % 2 === 0 ? 64 : 30;
        return `${(C + Math.cos(a) * rr).toFixed(1)},${(C + Math.sin(a) * rr).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" ${filled()}/><circle cx="${C}" cy="${C}" r="12" ${solid}/>`;
    }
    case 'pulsar': {
      // Central star + two crossed orbital rings.
      return (
        `<ellipse cx="${C}" cy="${C}" rx="60" ry="20" ${line()} transform="rotate(28 ${C} ${C})"/>` +
        `<ellipse cx="${C}" cy="${C}" rx="60" ry="20" ${line()} transform="rotate(-28 ${C} ${C})"/>` +
        `<circle cx="${C}" cy="${C}" r="14" ${solid}/>`
      );
    }
    case 'comet': {
      // Head + tail + sparkle.
      return (
        `<path d="M86 168 L150 104 a26 26 0 1 1 -2 -2 Z" ${filled()}/>` +
        `<circle cx="158" cy="98" r="22" ${solid}/>` +
        `<path d="M70 186 l10 -10 M84 192 l8 -8" ${line()}/>`
      );
    }
    case 'crystal': {
      // Faceted gem (kite) with internal facets — the wild.
      return (
        `<polygon points="128,52 176,108 128,204 80,108" ${filled()}/>` +
        `<path d="M80 108 L176 108 M128 52 L128 204 M104 108 L128 80 L152 108" ${line(3)}/>`
      );
    }
    case 'sigil': {
      // 5-point star sigil — the scatter.
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? 64 : 26;
        return `${(C + Math.cos(a) * rr).toFixed(1)},${(C + Math.sin(a) * rr).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" ${filled()}/><circle cx="${C}" cy="${C}" r="9" ${solid}/>`;
    }
    case 'shard':
    default: {
      // Faceted hexagonal shard with a rank letter — the low symbols.
      const hex = [
        [128, 60],
        [180, 96],
        [180, 160],
        [128, 196],
        [76, 160],
        [76, 96],
      ]
        .map((p) => p.join(','))
        .join(' ');
      const rank = sym.rank
        ? `<text x="128" y="148" text-anchor="middle" font-family="Georgia, serif" font-size="52" font-weight="700" ${solid}>${sym.rank}</text>`
        : '';
      return (
        `<polygon points="${hex}" ${filled()}/>` +
        `<path d="M76 128 L180 128 M128 60 L128 196" ${line(2, 0.5)}/>` +
        rank
      );
    }
  }
}

function svg(id, sym) {
  const { color, name, label } = sym;
  const caption = label
    ? `<text x="128" y="232" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="20" font-weight="700" letter-spacing="2" fill="${color}" fill-opacity="0.92">${label}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${name}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.16"/>
      <stop offset="55%" stop-color="#0d0726" stop-opacity="1"/>
      <stop offset="100%" stop-color="#05010f" stop-opacity="1"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="6" y="6" width="244" height="244" rx="26" fill="url(#bg)"/>
  <rect x="10" y="10" width="236" height="236" rx="22" fill="none" stroke="${color}" stroke-opacity="0.55" stroke-width="3"/>
  <g filter="url(#glow)">${icon(sym.icon, color, sym)}</g>
  ${caption}
</svg>
`;
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [id, sym] of Object.entries(SYMBOLS)) {
  writeFileSync(resolve(OUT, `${id}.svg`), svg(id, sym), 'utf8');
  n++;
}
console.log(`wrote ${n} placeholder symbol SVGs to frontend/public/symbols/`);
