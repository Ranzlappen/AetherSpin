/**
 * Asset base-URL strategy. In development assets resolve relative to the app; in
 * production set `VITE_ASSET_BASE` to the Stake CDN base URL so audio/art are
 * served from the CDN instead of the game bundle.
 *
 * @example
 * # .env.production
 * VITE_ASSET_BASE=https://cdn.stake-engine.com/novaforged/v1
 */
const RAW_BASE = import.meta.env.VITE_ASSET_BASE ?? '';

/** Normalized asset base URL (no trailing slash). Empty means "bundle-relative". */
export const ASSET_BASE = RAW_BASE.replace(/\/$/, '');

/**
 * Resolve an asset path against the configured base.
 * @param path Path relative to the asset root (e.g. `"audio/spin.mp3"`).
 */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, '');
  return ASSET_BASE ? `${ASSET_BASE}/${clean}` : clean;
}
