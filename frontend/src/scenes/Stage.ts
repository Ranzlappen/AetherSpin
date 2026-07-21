/**
 * Owns the {@link Application}, wires the scenes together, drives the RAF loop and
 * handles responsive resize. Exposes an FPS-monitor hook for the performance
 * budget. Pixi-only; the rest of the app talks to it through the event bus.
 */
import { Application, Container, type Ticker } from 'pixi.js';
import { Background } from './Background';
import { ReelEngine } from './ReelEngine';
import { Particles } from './Particles';
import { bus, type WinTier } from '../core/eventBus';
import { track } from '../core/telemetry';
import { preloadAssets } from '../core/assetLoader';
import { TARGET_FPS } from '../config/gameConfig';

/** Callback invoked roughly once per second with the measured FPS. */
export type FpsCallback = (fps: number) => void;

/** Options for {@link Stage.init}. */
export interface StageInitOptions {
  /** Canvas host element. */
  container: HTMLElement;
  /** Optional FPS monitor callback. */
  onFps?: FpsCallback;
  /** Suppress non-essential celebration motion (OS "reduce motion"). */
  reducedMotion?: boolean;
  /** Called when the WebGL context is lost (GPU reset / tab backgrounding). */
  onContextLost?: () => void;
  /** Called when the WebGL context is restored. */
  onContextRestored?: () => void;
}

/** The top-level Pixi scene graph and lifecycle owner. */
export class Stage {
  private app: Application | null = null;
  private world = new Container();
  private background: Background | null = null;
  private reels: ReelEngine | null = null;
  private particles: Particles | null = null;
  private onFps?: FpsCallback;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private resizeObserver: ResizeObserver | null = null;
  private celebrateOff: (() => void) | null = null;
  private freeSpinsOnOff: (() => void) | null = null;
  private freeSpinsEndOff: (() => void) | null = null;
  private reducedMotion = false;
  /** Reserved DOM-HUD bands (CSS px) the board must not sit under. */
  private insetTop = 0;
  private insetBottom = 0;
  private canvasEl: HTMLCanvasElement | null = null;
  /** Canvas host element — stamped with the logical layout size for tests. */
  private hostEl: HTMLElement | null = null;
  private onContextLost?: (e: Event) => void;
  private onContextRestored?: () => void;

  /** Design resolution the scene is laid out against. */
  static readonly DESIGN_WIDTH = 1280;
  static readonly DESIGN_HEIGHT = 800;

  /** Initialize the Pixi application and build the scene graph. */
  async init(options: StageInitOptions): Promise<void> {
    this.onFps = options.onFps;
    this.reducedMotion = options.reducedMotion ?? false;
    this.hostEl = options.container;
    const app = new Application();
    await app.init({
      antialias: true,
      backgroundAlpha: 1,
      background: 0x05010f,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      resizeTo: options.container,
    });
    this.app = app;
    options.container.appendChild(app.canvas);

    // Survive a lost GPU context (driver reset, tab backgrounding) instead of
    // freezing silently: preventDefault lets the browser restore it, and we
    // surface/clear a notice + telemetry around the gap.
    this.canvasEl = app.canvas as HTMLCanvasElement;
    this.onContextLost = (e: Event): void => {
      e.preventDefault();
      track({ type: 'render:contextlost' });
      options.onContextLost?.();
    };
    this.onContextRestored = (): void => {
      track({ type: 'render:restored' });
      options.onContextRestored?.();
    };
    this.canvasEl.addEventListener('webglcontextlost', this.onContextLost, false);
    this.canvasEl.addEventListener('webglcontextrestored', this.onContextRestored, false);

    // Preload declared art before building the board so symbol tiles can use it
    // (no-op when the manifest is empty → instant, procedural rendering). The
    // boot timeout in App.svelte bounds this, and any per-asset failure falls
    // back to procedural rather than blocking.
    await preloadAssets();

    this.background = new Background();
    this.reels = new ReelEngine(app.renderer);
    this.particles = new Particles();

    app.stage.addChild(this.background.view);
    app.stage.addChild(this.world);
    this.world.addChild(this.reels.view);
    app.stage.addChild(this.particles.view);

    app.ticker.maxFPS = TARGET_FPS;
    app.ticker.add(this.update, this);

    this.celebrateOff = bus.on('celebrate', (p) => this.onCelebrate(p.tier));
    // Bonus ambience: tint the background for the duration of free spins.
    this.freeSpinsOnOff = bus.on('freespins:start', () => this.background?.setFreeSpins(true));
    this.freeSpinsEndOff = bus.on('freespins:end', () => this.background?.setFreeSpins(false));

    this.observeResize(options.container);
    this.resize();
  }

  /** Per-frame update fanned out to scenes + FPS sampling. */
  private update(ticker: Ticker): void {
    this.background?.update(ticker);
    this.reels?.update(ticker);
    this.particles?.update(ticker);

    if (this.onFps) {
      this.fpsAccum += ticker.deltaMS;
      this.fpsFrames++;
      if (this.fpsAccum >= 1000) {
        this.onFps((this.fpsFrames * 1000) / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }
    }
  }

  /** Allow the host to follow OS "reduce motion" changes after init. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /**
   * Reserve the space the DOM HUD occupies at the top and bottom of the viewport
   * (in CSS px) so the board is fit into — and centred within — the clear band
   * between them, never underneath the controls. Re-fits immediately. The host
   * measures the live HUD (which wraps/grows on narrow screens) and feeds the
   * numbers here, keeping the layout watertight across viewports.
   */
  setInsets(top: number, bottom: number): void {
    const nextTop = Math.max(0, top);
    const nextBottom = Math.max(0, bottom);
    if (nextTop === this.insetTop && nextBottom === this.insetBottom) return;
    this.insetTop = nextTop;
    this.insetBottom = nextBottom;
    this.resize();
  }

  /** Fire a particle burst sized to the win tier. */
  private onCelebrate(tier: WinTier): void {
    if (!this.particles || !this.reels) return;
    // Reduced motion: skip non-essential celebratory particle bursts.
    if (this.reducedMotion) return;
    const { width, height } = this.reels.boardSize;
    const scale = this.world.scale.x;
    const cx = this.world.x + (width / 2) * scale;
    const cy = this.world.y + (height / 2) * scale;
    const power: Record<WinTier, number> = {
      small: 0.6,
      medium: 1,
      big: 1.5,
      mega: 2.2,
      epic: 2.6,
      wincap: 3,
    };
    const count: Record<WinTier, number> = {
      small: 24,
      medium: 50,
      big: 90,
      mega: 140,
      epic: 170,
      wincap: 200,
    };
    this.particles.burst(cx, cy, count[tier], power[tier]);
  }

  /** Observe host element size changes for responsive scaling. */
  private observeResize(container: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  /** Scale and center the reel board within the available viewport. */
  resize(): void {
    if (!this.app || !this.reels) return;
    // Use the logical screen size (CSS px). In Pixi v8 `renderer.width/height`
    // already return the logical size, so dividing by `resolution` (as the v7
    // API required) halves the layout on any DPR>=2 device — which put the board
    // at a quarter size in the top-left on real phones while desktop/CI (DPR 1)
    // looked fine. `app.screen` is the canonical logical viewport rectangle.
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.background?.resize(w, h);

    const { width, height } = this.reels.boardSize;
    // Fit the full presentation footprint (board frame included, when its art
    // loaded) into the clear band between the reserved HUD insets, with a small
    // side gutter so it never touches the screen edge. Centring the board within
    // that band centres the whole footprint (the frame is symmetric around it) —
    // this keeps the board clear of the top HUD and bottom controls at every
    // viewport instead of centring in the full viewport (which overlapped the
    // controls in short/landscape and wasted space in portrait).
    const fit = this.reels.fitSize;
    const sideGutter = Math.min(24, w * 0.03);
    const availW = Math.max(80, w - sideGutter * 2);
    const availH = Math.max(80, h - this.insetTop - this.insetBottom);
    const scale = Math.min(availW / fit.width, availH / fit.height);
    const centerY = this.insetTop + availH / 2;
    this.world.scale.set(scale);
    this.world.x = (w - width * scale) / 2;
    this.world.y = centerY - (height * scale) / 2;

    // Record the logical viewport the board was laid out against. This must
    // equal the CSS viewport at every device pixel ratio; the e2e responsiveness
    // guard asserts it, catching the class of bug where a DPR>1 device halves
    // the layout (Pixi v8 `renderer.width` is already logical — see above).
    if (this.hostEl) {
      this.hostEl.dataset.stageW = String(Math.round(w));
      this.hostEl.dataset.stageH = String(Math.round(h));
    }
  }

  /** The underlying Pixi application (null before {@link init}). */
  get application(): Application | null {
    return this.app;
  }

  /** Tear down everything. */
  destroy(): void {
    this.celebrateOff?.();
    this.freeSpinsOnOff?.();
    this.freeSpinsEndOff?.();
    this.resizeObserver?.disconnect();
    if (this.canvasEl && this.onContextLost)
      this.canvasEl.removeEventListener('webglcontextlost', this.onContextLost);
    if (this.canvasEl && this.onContextRestored)
      this.canvasEl.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.app?.ticker.remove(this.update, this);
    this.background?.destroy();
    this.reels?.destroy();
    this.particles?.destroy();
    this.app?.destroy(true, { children: true });
    this.app = null;
  }
}
