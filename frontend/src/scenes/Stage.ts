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
  private reducedMotion = false;

  /** Design resolution the scene is laid out against. */
  static readonly DESIGN_WIDTH = 1280;
  static readonly DESIGN_HEIGHT = 800;

  /** Initialize the Pixi application and build the scene graph. */
  async init(options: StageInitOptions): Promise<void> {
    this.onFps = options.onFps;
    this.reducedMotion = options.reducedMotion ?? false;
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
      wincap: 3,
    };
    const count: Record<WinTier, number> = {
      small: 24,
      medium: 50,
      big: 90,
      mega: 140,
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
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;

    this.background?.resize(w, h);

    const { width, height } = this.reels.boardSize;
    // Leave headroom for DOM UI overlay; fit the board into ~86% of the viewport.
    const margin = 0.86;
    const scale = Math.min((w * margin) / width, (h * margin) / height);
    const x = (w - width * scale) / 2;
    const y = (h - height * scale) / 2;
    this.world.scale.set(scale);
    this.world.x = x;
    this.world.y = y;
  }

  /** The underlying Pixi application (null before {@link init}). */
  get application(): Application | null {
    return this.app;
  }

  /** Tear down everything. */
  destroy(): void {
    this.celebrateOff?.();
    this.resizeObserver?.disconnect();
    this.app?.ticker.remove(this.update, this);
    this.background?.destroy();
    this.reels?.destroy();
    this.particles?.destroy();
    this.app?.destroy(true, { children: true });
    this.app = null;
  }
}
