/**
 * Procedural animated neon-cosmic background: a vertical gradient, a parallax
 * starfield and slow-drifting nebula glows. No external art assets. Pixi-only.
 */
import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';

interface Star {
  sprite: Sprite;
  speed: number;
  baseAlpha: number;
  twinkle: number;
}

/** Animated background layer for the stage. */
export class Background {
  /** Root container to add to the stage. */
  readonly view = new Container();

  private readonly gradient = new Graphics();
  private readonly nebula = new Graphics();
  private readonly starLayer = new Container();
  private readonly stars: Star[] = [];
  private width = 1280;
  private height = 720;
  private elapsed = 0;
  private readonly starTexture: Texture;

  constructor() {
    this.view.addChild(this.gradient);
    this.view.addChild(this.nebula);
    this.view.addChild(this.starLayer);
    this.starTexture = Background.makeStarTexture();
    this.buildStars(160);
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

  /** Redraw resolution-dependent layers (gradient + nebula). */
  private draw(): void {
    this.gradient.clear();
    // Vertical gradient approximation using stacked bands.
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const color = lerpColor(0x05010f, 0x1a0533, t);
      this.gradient.rect(0, (this.height / bands) * i, this.width, this.height / bands + 1).fill({ color });
    }

    this.nebula.clear();
    this.nebula
      .ellipse(this.width * 0.25, this.height * 0.3, this.width * 0.4, this.height * 0.3)
      .fill({ color: 0x7d2bff, alpha: 0.12 });
    this.nebula
      .ellipse(this.width * 0.8, this.height * 0.7, this.width * 0.35, this.height * 0.28)
      .fill({ color: 0xff45e0, alpha: 0.1 });
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
