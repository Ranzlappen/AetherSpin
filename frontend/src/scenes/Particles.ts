/**
 * Procedural win-celebration particle burst. Emits short-lived glowing sparks in
 * theme colors. Pooled for performance. Pixi-only.
 */
import { Container, Graphics, Ticker } from 'pixi.js';

interface Particle {
  view: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  active: boolean;
}

const PALETTE = [0x7df9ff, 0xff45e0, 0xffd166, 0xb388ff, 0x4dd0e1];

/** A pooled particle system for win celebrations. */
export class Particles {
  /** Container to add to the stage (above the reels). */
  readonly view = new Container();
  private readonly pool: Particle[] = [];

  constructor(capacity = 220) {
    for (let i = 0; i < capacity; i++) {
      const g = new Graphics();
      g.star(0, 0, 5, 6, 3).fill({ color: 0xffffff });
      g.visible = false;
      this.view.addChild(g);
      this.pool.push({ view: g, vx: 0, vy: 0, life: 0, maxLife: 0, spin: 0, active: false });
    }
  }

  /**
   * Emit a burst of particles at a point.
   * @param x Origin x (stage coords).
   * @param y Origin y.
   * @param count Number of particles (clamped to free pool slots).
   * @param power Initial speed scalar.
   */
  burst(x: number, y: number, count = 60, power = 1): void {
    let emitted = 0;
    for (const p of this.pool) {
      if (emitted >= count) break;
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = (120 + Math.random() * 320) * power;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 120 * power;
      p.maxLife = 0.6 + Math.random() * 0.9;
      p.life = p.maxLife;
      p.spin = (Math.random() - 0.5) * 12;
      p.active = true;
      p.view.visible = true;
      p.view.x = x;
      p.view.y = y;
      const s = 0.6 + Math.random() * 1.4;
      p.view.scale.set(s);
      p.view.tint = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      p.view.alpha = 1;
      emitted++;
    }
  }

  /** Advance and recycle particles. Driven by the stage ticker. */
  update(ticker: Ticker): void {
    const dt = ticker.deltaMS / 1000;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.view.visible = false;
        continue;
      }
      p.vy += 520 * dt; // gravity
      p.view.x += p.vx * dt;
      p.view.y += p.vy * dt;
      p.view.rotation += p.spin * dt;
      p.view.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  /** Tear down resources. */
  destroy(): void {
    this.view.destroy({ children: true });
  }
}
