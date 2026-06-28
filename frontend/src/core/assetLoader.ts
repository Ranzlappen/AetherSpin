/**
 * Active asset preload + lookup, the runtime half of the asset pipeline.
 *
 * {@link config/assets.ts} declares *what* art exists (the manifest, CDN base,
 * cache-busting); this module *loads* it through Pixi `Assets` at boot and lets
 * the renderer ask for a loaded texture by key. It is deliberately
 * fault-tolerant: a missing or undecodable asset is logged and skipped, never
 * thrown — so the game falls back to its procedural rendering and still runs in
 * environments with no art (the default today, where the manifest is empty).
 *
 * Keys are the manifest's own asset keys (e.g. `"symbol:H1"`); the renderer
 * queries them via {@link AssetRegistry.getTexture}.
 */
import { Assets, type Texture } from 'pixi.js';
import { ASSET_MANIFEST, assetUrl, type AssetGroup } from '../config/assets';

/** Loads one resolved URL to a Texture. Injectable so tests avoid real I/O. */
export type TextureLoader = (url: string) => Promise<Texture>;

const defaultLoader: TextureLoader = (url) => Assets.load<Texture>(url);

export interface PreloadOptions {
  /** Manifest to load (defaults to the app's {@link ASSET_MANIFEST}). */
  manifest?: readonly AssetGroup[];
  /** Texture loader (defaults to Pixi `Assets.load`). */
  load?: TextureLoader;
  /** Progress callback: (loaded, total) after each asset settles. */
  onProgress?: (loaded: number, total: number) => void;
}

/** A keyed registry of loaded textures with a procedural-friendly miss path. */
export class AssetRegistry {
  private readonly textures = new Map<string, Texture>();
  private preloaded = false;

  /** The loaded texture for `key`, or `null` if it isn't loaded (→ fall back). */
  getTexture(key: string): Texture | null {
    return this.textures.get(key) ?? null;
  }

  /** Whether a texture is loaded for `key`. */
  has(key: string): boolean {
    return this.textures.has(key);
  }

  /** Register a texture directly (used by {@link preload} and by tests). */
  register(key: string, texture: Texture): void {
    this.textures.set(key, texture);
  }

  /** Drop all loaded textures and reset the preload latch (tests/teardown). */
  clear(): void {
    this.textures.clear();
    this.preloaded = false;
  }

  /**
   * Load every asset in the manifest. Idempotent (subsequent calls no-op). Each
   * asset is loaded independently and a failure is swallowed (logged) so one bad
   * file can't block boot or the rest of the batch. Returns the keys that loaded.
   */
  async preload(options: PreloadOptions = {}): Promise<string[]> {
    if (this.preloaded) return [...this.textures.keys()];
    this.preloaded = true;

    const manifest = options.manifest ?? ASSET_MANIFEST;
    const load = options.load ?? defaultLoader;
    const entries: Array<[string, string]> = manifest.flatMap((g) => Object.entries(g.assets));
    const total = entries.length;
    let done = 0;
    const loadedKeys: string[] = [];

    for (const [key, path] of entries) {
      try {
        const texture = await load(assetUrl(path));
        this.textures.set(key, texture);
        loadedKeys.push(key);
      } catch (err) {
        // Fault-tolerant: skip this asset, keep the procedural fallback for it.
        console.warn(`[assets] failed to load "${key}" (${path}); using fallback:`, err);
      } finally {
        options.onProgress?.(++done, total);
      }
    }
    return loadedKeys;
  }
}

/** App-wide singleton the renderer reads from and {@link preloadAssets} fills. */
export const assetRegistry = new AssetRegistry();

/**
 * Boot-phase convenience: load the configured manifest into the singleton.
 * A no-op (instant) when the manifest is empty, so it's always safe to await.
 * Emits a single `[assets] ready: <loaded>/<total>` marker (when anything is
 * declared) — the E2E asset-load check asserts on it in a real browser.
 */
export async function preloadAssets(options: PreloadOptions = {}): Promise<string[]> {
  const manifest = options.manifest ?? ASSET_MANIFEST;
  const total = manifest.flatMap((g) => Object.values(g.assets)).length;
  const loaded = await assetRegistry.preload(options);
  if (total > 0) console.info(`[assets] ready: ${loaded.length}/${total} loaded`);
  return loaded;
}
