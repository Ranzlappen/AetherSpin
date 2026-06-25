/**
 * Asset resolution + manifest seam.
 *
 * The renderer currently draws every symbol procedurally (no external art), so
 * there are no binary assets to ship today. This module is the seam real art
 * plugs into: declare assets in {@link ASSET_MANIFEST}, resolve their URLs with
 * {@link assetUrl} (CDN base + cache-busting), and a future preload phase can
 * load the manifest through Pixi `Assets`. A missing-asset CI check can diff the
 * manifest against the deployed bundle.
 *
 * @example
 * # .env.production
 * VITE_ASSET_BASE=https://cdn.stake-engine.com/novaforged
 * VITE_ASSET_VERSION=1.1.0
 */
const RAW_BASE = import.meta.env.VITE_ASSET_BASE ?? '';

/** Normalized asset base URL (no trailing slash). Empty means "bundle-relative". */
export const ASSET_BASE = RAW_BASE.replace(/\/$/, '');

/** Cache-busting version appended to CDN asset URLs (empty in dev). */
export const ASSET_VERSION = (import.meta.env.VITE_ASSET_VERSION ?? '').trim();

/**
 * Resolve an asset path against the configured base, with cache-busting.
 * @param path Path relative to the asset root (e.g. `"audio/spin.mp3"`).
 */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, '');
  const url = ASSET_BASE ? `${ASSET_BASE}/${clean}` : clean;
  // Only cache-bust CDN-served assets; bundle-relative ones are already hashed.
  return ASSET_BASE && ASSET_VERSION ? `${url}?v=${encodeURIComponent(ASSET_VERSION)}` : url;
}

/** A declared asset group: a logical preload bucket (e.g. boot vs feature). */
export interface AssetGroup {
  /** Group name used to phase loading (e.g. `"boot"`, `"freespins"`). */
  name: string;
  /** Asset keys → paths (relative to the asset root). */
  assets: Record<string, string>;
}

/**
 * Declared assets, grouped by preload phase. Empty today (procedural rendering);
 * real art is added here and resolved via {@link assetUrl}. Keeping it explicit
 * lets a missing-asset CI check verify every declared asset actually ships.
 */
export const ASSET_MANIFEST: readonly AssetGroup[] = [];

/** Flat list of every declared asset URL (for preload / CI verification). */
export function manifestUrls(): string[] {
  return ASSET_MANIFEST.flatMap((g) => Object.values(g.assets)).map(assetUrl);
}
