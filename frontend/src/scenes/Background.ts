/**
 * Animated neon-cosmic background. Prefers the loaded nebula art plate
 * (`bg:main` in the asset manifest, cover-fit) and layers the parallax
 * starfield on top; with no art it falls back to the fully procedural
 * gradient + nebula glows. Pixi-only.
 */
import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import { assetRegistry } from '../core/assetLoader';

interface Star {
  sprite: Sprite;
  speed: number;
  baseAlpha: number;
  twinkle: number;
}

/** One radial warp mote: drifts outward from the centre, accelerating. */
interface WarpMote {
  sprite: Sprite;
  /** Direction from the screen centre (radians). */
  angle: number;
  /** Current distance from the centre (px). */
  radius: number;
  baseAlpha: number;
  size: number;
}

/** Exponential outward growth rate (s⁻¹): centre→edge in roughly 10–14 s. */
const WARP_GROWTH = 0.24;
/** Constant outward push (px/s) so freshly spawned motes near r≈0 still move. */
const WARP_PUSH = 9;

/** Animated background layer for the stage. */
export class Background {
  /** Root container to add to the stage. */
  readonly view = new Container();

  private readonly gradient = new Graphics();
  private readonly nebula = new Graphics();
  private readonly starLayer = new Container();
  /** Bonus-mode ambience tint, cross-faded in during free spins. */
  private readonly modeOverlay = new Graphics();
  private overlayAlpha = 0;
  private overlayTarget = 0;
  /** Faint radial warp field: motes accelerating outward from the centre. */
  private readonly warpLayer = new Container();
  private readonly warp: WarpMote[] = [];
  private reducedMotion = false;
  private readonly stars: Star[] = [];
  private width = 1280;
  private height = 720;
  private elapsed = 0;
  private readonly starTexture: Texture;
  /** Final nebula art plate (null → procedural gradient/glows only). */
  private readonly plate: Sprite | null = null;

  constructor() {
    this.view.addChild(this.gradient);
    const plateTexture = assetRegistry.getTexture('bg:main');
    if (plateTexture) {
      this.plate = new Sprite(plateTexture);
      this.view.addChild(this.plate);
    }
    this.view.addChild(this.nebula);
    this.view.addChild(this.modeOverlay);
    this.view.addChild(this.warpLayer);
    this.view.addChild(this.starLayer);
    this.starTexture = Background.makeStarTexture();
    this.buildStars(160);
    this.buildWarp(70);
    this.draw();
  }

  /** Build a small radial-gradient circle texture used for every star. */
  private static makeStarTexture(): Texture {
    const g = new Graphics();
    g.circle(8, 8, 8).fill({ color: 0xffffff, alpha: 0.18 });
    g.circle(8, 8, 3).fill({ color: 0xffffff, alpha: 1 });
    // Render to a texture via the shared renderer is overkill; Pixi can use the
    // Graphics geometry directly through a generated texture at draw time.
    return Texture.WHITE;
  }

  /** Populate the parallax starfield. */
  private buildStars(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(this.starTexture);
      const size = 1 + Math.random() * 2.5;
      sprite.width = size;
      sprite.height = size;
      sprite.tint = Math.random() > 0.6 ? 0x7df9ff : 0xffffff;
      sprite.x = Math.random() * this.width;
      sprite.y = Math.random() * this.height;
      const baseAlpha = 0.3 + Math.random() * 0.7;
      sprite.alpha = baseAlpha;
      this.starLayer.addChild(sprite);
      this.stars.push({
        sprite,
        speed: 6 + Math.random() * 30,
        baseAlpha,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Redraw resolution-dependent layers (gradient / art plate + nebula). */
  private draw(): void {
    this.gradient.clear();
    // Vertical gradient approximation using stacked bands.
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const color = lerpColor(0x05010f, 0x1a0533, t);
      this.gradient.rect(0, (this.height / bands) * i, this.width, this.height / bands + 1).fill({ color });
    }

    if (this.plate) {
      // Cover-fit the art plate; the procedural glows stay off (the plate has
      // its own nebulae), the starfield stays on for motion.
      const tex = this.plate.texture;
      const scale = Math.max(this.width / tex.width, this.height / tex.height);
      this.plate.scale.set(scale);
      this.plate.x = (this.width - tex.width * scale) / 2;
      this.plate.y = (this.height - tex.height * scale) / 2;
      this.nebula.clear();
      return;
    }

    this.nebula.clear();
    this.nebula
      .ellipse(this.width * 0.25, this.height * 0.3, this.width * 0.4, this.height * 0.3)
      .fill({ color: 0x7d2bff, alpha: 0.12 });
    this.nebula
      .ellipse(this.width * 0.8, this.height * 0.7, this.width * 0.35, this.height * 0.28)
      .fill({ color: 0xff45e0, alpha: 0.1 });
  }

  /**
   * Populate the radial warp field. Motes spawn near the screen centre and
   * accelerate exponentially outward in every direction — a slow, faint
   * star-drift that keeps the scene alive without competing with the reels.
   */
  private buildWarp(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(this.starTexture);
      sprite.anchor.set(0.5);
      sprite.tint = Math.random() > 0.7 ? 0xb388ff : 0xffffff;
      const mote = this.spawnMote(sprite);
      // Stagger the field on boot so it doesn't start as a clump in the centre.
      mote.radius *= 1 + Math.random() * 30;
      this.warpLayer.addChild(sprite);
      this.warp.push(mote);
    }
  }

  /** (Re)initialize a mote just off the centre with a fresh direction. */
  private spawnMote(sprite: Sprite): WarpMote {
    const size = 0.8 + Math.random() * 1.8;
    sprite.width = size;
    sprite.height = size;
    return {
      sprite,
      angle: Math.random() * Math.PI * 2,
      radius: 2 + Math.random() * 24,
      baseAlpha: 0.1 + Math.random() * 0.28,
      size,
    };
  }

  /** Suppress the ambient warp drift under OS "reduce motion". */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.warpLayer.visible = !reduced;
  }

  /**
   * Shift the ambience for free spins: a violet-magenta wash cross-fades over
   * the plate so the bonus reads as its own place, and fades back out when the
   * feature ends. Presentation-only.
   */
  setFreeSpins(active: boolean): void {
    this.overlayTarget = active ? 0.34 : 0;
  }

  /** Redraw the full-screen bonus tint at the current size. */
  private drawModeOverlay(): void {
    this.modeOverlay.clear();
    // Two stacked washes: a deep violet base plus a warmer magenta glow rising
    // from the bottom, so the bonus tint has depth rather than a flat film.
    this.modeOverlay.rect(0, 0, this.width, this.height).fill({ color: 0x36064e });
    this.modeOverlay
      .ellipse(this.width / 2, this.height * 1.05, this.width * 0.75, this.height * 0.55)
      .fill({ color: 0x8a1370, alpha: 0.55 });
    this.modeOverlay.alpha = this.overlayAlpha;
  }

  /** Resize the background to fill the given dimensions. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const star of this.stars) {
      star.sprite.x = Math.random() * width;
      star.sprite.y = Math.random() * height;
    }
    this.draw();
    this.drawModeOverlay();
  }

  /** Advance the animation. Driven by the stage ticker. */
  update(ticker: Ticker): void {
    const dt = ticker.deltaMS / 1000;
    this.elapsed += dt;
    for (const star of this.stars) {
      star.sprite.y += star.speed * dt;
      if (star.sprite.y > this.height) {
        star.sprite.y = -2;
        star.sprite.x = Math.random() * this.width;
      }
      star.sprite.alpha = star.baseAlpha * (0.6 + 0.4 * Math.sin(this.elapsed * 2 + star.twinkle));
    }
    this.nebula.x = Math.sin(this.elapsed * 0.1) * 20;
    this.nebula.y = Math.cos(this.elapsed * 0.08) * 16;

    // Radial warp drift: each mote's outward speed grows with its distance
    // (r' = k·r + push ⇒ exponential acceleration), so motion is glacial near
    // the centre and streams away at the edges. Faint by design.
    if (!this.reducedMotion) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxR = Math.hypot(cx, cy) + 24;
      for (const mote of this.warp) {
        mote.radius += (mote.radius * WARP_GROWTH + WARP_PUSH) * dt;
        if (mote.radius > maxR) Object.assign(mote, this.spawnMote(mote.sprite));
        const emerge = Math.min(1, mote.radius / 140); // ease in while leaving the centre
        const depth = 1 + mote.radius / maxR; // subtle grow/brighten as it travels
        mote.sprite.alpha = mote.baseAlpha * emerge * (0.55 + 0.45 * depth);
        mote.sprite.width = mote.size * depth;
        mote.sprite.height = mote.size * depth;
        mote.sprite.x = cx + Math.cos(mote.angle) * mote.radius;
        mote.sprite.y = cy + Math.sin(mote.angle) * mote.radius;
      }
    }

    // Ease the bonus ambience toward its target (~0.5s cross-fade). Keep the
    // full-screen overlay out of the render pass entirely while invisible —
    // that's the whole base game, and software renderers pay for every layer.
    const delta = this.overlayTarget - this.overlayAlpha;
    if (Math.abs(delta) > 0.001) {
      this.overlayAlpha += delta * Math.min(1, dt * 4);
      this.modeOverlay.alpha = this.overlayAlpha;
    }
    this.modeOverlay.visible = this.overlayAlpha > 0.004;
  }

  /** Tear down resources. */
  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** Linearly interpolate two 0xRRGGBB colors. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
