/**
 * 5x3 reel renderer with procedural symbol textures (no external art), smooth
 * spin, staggered reel stops, anticipation on the final reels, win-line
 * highlighting, expanding wilds and multiplier-wild badges.
 *
 * Symbols are drawn procedurally from each symbol's definition color + letter, so
 * the game runs with zero art assets. Pixi-only; it reacts to intents emitted on
 * the shared event bus.
 */
import {
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  Texture,
  Sprite,
  type Renderer,
  type Ticker,
} from 'pixi.js';
import type { Board, Win } from '../../../shared/src/types/events';
import {
  NUM_REELS,
  NUM_ROWS,
  paylines,
  getSymbol,
  getSymbolColor,
  wildSymbolId,
  scatterSymbolId,
} from '../config/gameConfig';
import { bus } from '../core/eventBus';
import { assetRegistry } from '../core/assetLoader';

const SYMBOL_SIZE = 132;
const SYMBOL_GAP = 8;
const CELL = SYMBOL_SIZE + SYMBOL_GAP;
const REEL_WIDTH = CELL;
const BOARD_WIDTH = REEL_WIDTH * NUM_REELS;
const BOARD_HEIGHT = CELL * NUM_ROWS;
/**
 * The delivered frame plate's transparent opening, measured (flood-filled) from
 * the 1152×768 art: x 220–932 (712 wide), y 180–588 (408 tall), centred. The
 * frame is sized so this opening lands `FRAME_MARGIN` px outside the board on
 * every side — the reels sit fully inside the window with a small clean gap, and
 * the foreground plate never slices a symbol.
 */
const FRAME_WINDOW_X = 712 / 1152;
const FRAME_WINDOW_Y = 408 / 768;
/** Clean gap (px) between the board edge and the metal opening, each side. */
const FRAME_MARGIN = 16;

/** A single symbol cell sprite (background tile + glyph). */
interface Cell {
  container: Container;
  bg: Graphics;
  glyph: Text;
  badge: Container;
  badgeText: Text;
  symbolId: string;
}

/** Per-reel spin state. */
interface ReelState {
  cells: Cell[];
  spinning: boolean;
  /** Visual scroll offset used during the spin blur. */
  offset: number;
  speed: number;
  /** Timestamp (ms accumulator) at which this reel should stop. */
  stopAt: number;
  pendingBoard: string[] | null;
}

/** Renders and animates the reels. */
export class ReelEngine {
  /** Root container to add to the stage. */
  readonly view = new Container();

  private readonly reels: ReelState[] = [];
  private readonly reelContainers: Container[] = [];
  private readonly maskGfx = new Graphics();
  private readonly frame = new Graphics();
  /** Solid, opaque reel-cabinet backdrop drawn behind the symbols. */
  private readonly boardBackdrop = new Graphics();
  private frameArt: Sprite | null = null;
  /** Wordmark marquee sitting on the frame's top metal band. */
  private logoArt: Sprite | null = null;
  private readonly lineOverlay = new Graphics();
  /** Additive glow sprites over winning cells (uses the `fx:cellGlow` art). */
  private readonly glowLayer = new Container();
  private readonly textureCache = new Map<string, Texture>();
  /** Alpha-trimmed views over registry art (share their source — see destroy). */
  private readonly trimmedViews = new Set<Texture>();
  /** Textures generated here (procedural tiles) — fully owned, fully destroyed. */
  private readonly ownedTextures = new Set<Texture>();
  private readonly renderer: Renderer;
  private elapsed = 0;
  private board: Board = [];
  private spinResolve: (() => void) | null = null;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.buildFrame();
    this.buildReels();
    this.view.addChild(this.lineOverlay);
    this.view.addChild(this.glowLayer);
    this.applyMask();
    // Lift the metal plate to the foreground so the reels spin *behind* the
    // frame (its inner lip overlaps the reel edges) rather than the symbols
    // floating on top of it. Re-adding moves the existing child to the top.
    if (this.frameArt) this.view.addChild(this.frameArt);
    // The marquee sits on the plate's top band, so it rides above the plate.
    if (this.logoArt) this.view.addChild(this.logoArt);
    this.subscribe();
  }

  /** Width/height of the reel board in pixels (for layout). */
  get boardSize(): { width: number; height: number } {
    return { width: BOARD_WIDTH, height: BOARD_HEIGHT };
  }

  /**
   * Footprint the stage should fit into the viewport: the art frame's full
   * extent when it loaded, else the board plus the procedural frame margin.
   */
  get fitSize(): { width: number; height: number } {
    if (this.frameArt) return { width: this.frameArt.width, height: this.frameArt.height };
    return { width: BOARD_WIDTH + 24, height: BOARD_HEIGHT + 24 };
  }

  /**
   * Build the frame around the reels: a solid reel-cabinet backdrop, then the
   * final frame plate (`ui:frame`) on top of it when loaded — scaled so its
   * transparent window wraps the board; otherwise the procedural neon frame.
   *
   * The backdrop sits *behind* the metal plate and deliberately overfills the
   * plate's transparent window, so the metal hides its edges and no nebula shows
   * through the seam between the board and the frame.
   */
  private buildFrame(): void {
    this.buildBoardBackdrop();
    const art = assetRegistry.getTexture('ui:frame');
    if (art) {
      // Size the plate so its measured opening lands FRAME_MARGIN px outside the
      // board on every side: the reels sit fully inside the window (the
      // foreground plate never clips a symbol) with only a thin backdrop gap.
      this.frameArt = new Sprite(art);
      this.frameArt.width = (BOARD_WIDTH + FRAME_MARGIN * 2) / FRAME_WINDOW_X;
      this.frameArt.height = (BOARD_HEIGHT + FRAME_MARGIN * 2) / FRAME_WINDOW_Y;
      this.frameArt.x = (BOARD_WIDTH - this.frameArt.width) / 2;
      this.frameArt.y = (BOARD_HEIGHT - this.frameArt.height) / 2;
      this.view.addChild(this.frameArt);
      this.buildLogoMarquee();
      return;
    }
    this.frame
      .roundRect(-12, -12, BOARD_WIDTH + 24, BOARD_HEIGHT + 24, 18)
      .stroke({ color: 0x7df9ff, width: 3, alpha: 0.8 });
    this.view.addChild(this.frame);
  }

  /**
   * The wordmark rendered as a cabinet marquee, centred on the metal band
   * between the frame's top edge and the reel window — so the game is branded
   * in-play (not just on the loading screen) the way a finished cabinet is.
   * Skipped when either the frame or the logo art is missing.
   */
  private buildLogoMarquee(): void {
    if (!this.frameArt) return;
    const art = assetRegistry.getTexture('brand:logo');
    if (!art) return;
    const texture = trimTexture(art);
    if (texture !== art) this.trimmedViews.add(texture);
    const bandTop = this.frameArt.y;
    const bandHeight = -FRAME_MARGIN - bandTop;
    if (bandHeight <= 0) return;
    const logo = new Sprite(texture);
    const fit = Math.min((bandHeight * 0.92) / texture.height, (this.frameArt.width * 0.42) / texture.width);
    logo.width = texture.width * fit;
    logo.height = texture.height * fit;
    logo.anchor.set(0.5);
    logo.x = BOARD_WIDTH / 2;
    logo.y = bandTop + bandHeight * 0.5;
    this.logoArt = logo;
    this.view.addChild(logo);
  }

  /**
   * Draw the opaque reel-cabinet backdrop: a solid base overfilling the frame
   * window (so no background shows through), five distinct reel columns with
   * darker gutters and a soft centre sheen, and top/bottom inner shadows for
   * depth — so the board reads as five real spinning reels rather than a
   * translucent pane.
   */
  private buildBoardBackdrop(): void {
    // Overfill well past the (now tighter) frame window so the metal hides the
    // backdrop edges and no nebula leaks through the seam — the plate is scaled
    // down (FRAME_SCALE) to hug the reels, so the backdrop must reach further out
    // than the board to stay under the metal lip on every side.
    const padX = 52;
    const padY = 60;
    const x = -padX;
    const y = -padY;
    const w = BOARD_WIDTH + padX * 2;
    const h = BOARD_HEIGHT + padY * 2;
    const g = this.boardBackdrop;
    g.clear();
    // Solid, fully opaque base (no alpha) — the reels must not be see-through.
    g.roundRect(x, y, w, h, 22).fill({ color: 0x0a0522 });
    for (let r = 0; r < NUM_REELS; r++) {
      const cx = r * REEL_WIDTH;
      // Lighter reel face.
      g.rect(cx + 3, y, REEL_WIDTH - 6, h).fill({ color: 0x17103f });
      // Soft vertical sheen down the reel centre (tube highlight).
      g.rect(cx + REEL_WIDTH / 2 - 22, y, 44, h).fill({ color: 0x241a5c, alpha: 0.45 });
      // Dark gutter between reels.
      if (r > 0) g.rect(cx - 1.5, y, 3, h).fill({ color: 0x04010e });
    }
    // Inner top/bottom shadows anchored to the visible board edge (the wide
    // overfill above sits under the metal, so edge-anchored shadows keep the
    // depth cue inside the frame window).
    g.rect(x, -8, w, 18).fill({ color: 0x000000, alpha: 0.4 });
    g.rect(x, BOARD_HEIGHT - 10, w, 18).fill({ color: 0x000000, alpha: 0.4 });
    this.view.addChild(g);
  }

  /** Construct every reel and cell with placeholder symbols. */
  private buildReels(): void {
    for (let r = 0; r < NUM_REELS; r++) {
      const reelContainer = new Container();
      reelContainer.x = r * REEL_WIDTH;
      this.view.addChild(reelContainer);
      this.reelContainers.push(reelContainer);
      const cells: Cell[] = [];
      // One extra cell above and below for seamless spin scroll. The idle
      // board is cosmetic until the first reveal — vary it so boot doesn't
      // show a wall of one symbol.
      for (let row = 0; row < NUM_ROWS + 2; row++) {
        const cell = this.makeCell(randomSpinSymbol());
        cell.container.x = SYMBOL_GAP / 2;
        cell.container.y = (row - 1) * CELL + SYMBOL_GAP / 2;
        reelContainer.addChild(cell.container);
        cells.push(cell);
      }
      this.reels.push({
        cells,
        spinning: false,
        offset: 0,
        speed: 0,
        stopAt: 0,
        pendingBoard: null,
      });
    }
  }

  /** Apply a rectangular mask so spinning symbols are clipped to the board. */
  private applyMask(): void {
    this.maskGfx.rect(0, 0, BOARD_WIDTH, BOARD_HEIGHT).fill({ color: 0xffffff });
    this.view.addChild(this.maskGfx);
    for (const reelContainer of this.reelContainers) {
      reelContainer.mask = this.maskGfx;
    }
    this.lineOverlay.mask = this.maskGfx;
  }

  /** Create a single symbol cell. */
  private makeCell(symbolId: string): Cell {
    const container = new Container();
    const bg = new Graphics();
    container.addChild(bg);

    const glyph = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 56,
        fontWeight: '900',
        fill: 0xffffff,
        align: 'center',
      }),
    });
    glyph.anchor.set(0.5);
    glyph.x = SYMBOL_SIZE / 2;
    glyph.y = SYMBOL_SIZE / 2;
    container.addChild(glyph);

    // Multiplier-wild badge (hidden by default).
    const badge = new Container();
    const badgeBg = new Graphics();
    badgeBg.circle(0, 0, 20).fill({ color: 0xff45e0 });
    badgeBg.circle(0, 0, 20).stroke({ color: 0xffffff, width: 2 });
    const badgeText = new Text({
      text: 'x2',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 20, fontWeight: '900', fill: 0xffffff }),
    });
    badgeText.anchor.set(0.5);
    badge.addChild(badgeBg);
    badge.addChild(badgeText);
    badge.x = SYMBOL_SIZE - 18;
    badge.y = 18;
    badge.visible = false;
    container.addChild(badge);

    const cell: Cell = { container, bg, glyph, badge, badgeText, symbolId };
    this.setCellSymbol(cell, symbolId);
    return cell;
  }

  /**
   * The tile texture for a symbol id. Prefers loaded art
   * (`symbol:<id>` in the {@link assetRegistry}) and falls back to a procedural
   * tile when none is present — so dropping real art into the manifest needs no
   * renderer change, and with no art the look is unchanged.
   */
  private symbolTexture(symbolId: string): Texture {
    const cached = this.textureCache.get(symbolId);
    if (cached) return cached;
    const art = assetRegistry.getTexture(`symbol:${symbolId}`);
    if (art) {
      // Delivered symbol plates carry generous transparent padding (some gems
      // occupy barely a third of the 512² canvas), which made the board read
      // sparse. Trim to the alpha bounding box so the artwork itself — not its
      // padding — is what gets fitted into the cell.
      const trimmed = trimTexture(art);
      if (trimmed !== art) this.trimmedViews.add(trimmed);
      this.textureCache.set(symbolId, trimmed);
      return trimmed;
    }
    const color = parseInt(getSymbolColor(symbolId).replace('#', ''), 16);
    const g = new Graphics();
    g.roundRect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE, 14).fill({ color: 0x0d0726 });
    g.roundRect(3, 3, SYMBOL_SIZE - 6, SYMBOL_SIZE - 6, 12).fill({ color, alpha: 0.16 });
    g.roundRect(3, 3, SYMBOL_SIZE - 6, SYMBOL_SIZE - 6, 12).stroke({ color, width: 3, alpha: 0.9 });
    const tex = this.renderer.generateTexture(g);
    g.destroy();
    this.ownedTextures.add(tex);
    this.textureCache.set(symbolId, tex);
    return tex;
  }

  /** Render a symbol into a cell (tile sprite + glyph letter). */
  private setCellSymbol(cell: Cell, symbolId: string): void {
    cell.symbolId = symbolId;
    cell.bg.clear();
    // Use a sprite from the cached texture for the tile background. Art
    // textures are alpha-trimmed, so aspect-fit the real content into the cell
    // (centred); procedural tiles are square and fill it exactly.
    cell.bg.removeChildren();
    const texture = this.symbolTexture(symbolId);
    const tile = new Sprite(texture);
    const box = SYMBOL_SIZE * (this.trimmedViews.has(texture) ? 0.98 : 1);
    const fit = Math.min(box / texture.width, box / texture.height);
    tile.width = texture.width * fit;
    tile.height = texture.height * fit;
    tile.anchor.set(0.5);
    tile.x = SYMBOL_SIZE / 2;
    tile.y = SYMBOL_SIZE / 2;
    cell.bg.addChild(tile);

    // The procedural glyph letter is only a stand-in for missing art; when a
    // real symbol texture is loaded, the tile carries its own artwork and the
    // letter is hidden.
    const hasArt = assetRegistry.has(`symbol:${symbolId}`);
    cell.glyph.visible = !hasArt;
    const meta = getSymbol(symbolId);
    const color = getSymbolColor(symbolId);
    cell.glyph.text = hasArt ? '' : labelFor(symbolId);
    cell.glyph.style.fill = color;
    cell.glyph.style.fontSize = meta?.kind === 'low' ? 44 : 52;
    cell.badge.visible = false;
  }

  /** Subscribe to bus intents. */
  private subscribe(): void {
    bus.on('reels:spin', (p) => this.startSpin(p.turbo));
    bus.on('board:reveal', (p) => this.revealBoard(p.board, p));
    bus.on('wins:lines', (p) => this.highlightWins(p.wins));
    bus.on('reels:skip', () => this.skipToSettle());
  }

  /** Begin spinning every reel; returns when all reels are at full speed. */
  startSpin(turbo = false): void {
    this.clearHighlights();
    this.turbo = turbo;
    this.pendingSkip = false;
    for (let r = 0; r < NUM_REELS; r++) {
      const reel = this.reels[r];
      reel.spinning = true;
      reel.speed = (turbo ? 3200 : 2400) + r * 80;
      reel.pendingBoard = null;
    }
  }

  /**
   * Settle every spinning reel on the next tick (player skip). If the final
   * board hasn't been revealed yet the skip is remembered and applied as soon
   * as it arrives — a skip must never invent an outcome.
   */
  private skipToSettle(): void {
    const revealed = this.reels.some((reel) => reel.pendingBoard !== null);
    if (!revealed) {
      this.pendingSkip = true;
      return;
    }
    for (const reel of this.reels) {
      if (reel.spinning) reel.stopAt = this.elapsed;
    }
  }

  /**
   * Reveal a final board, stopping reels in a staggered cascade. If two scatters
   * are visible across the first reels an anticipation slow-down is applied to
   * the trailing reels. Returns a promise that resolves once all reels settle.
   */
  revealBoard(
    board: Board,
    opts?: {
      expandedReels?: number[];
      multiplierWilds?: Array<{ reel: number; row: number; value: number }>;
      anticipation?: boolean;
      turbo?: boolean;
    }
  ): Promise<void> {
    this.board = board.map((col) => [...col]);
    const expanded = new Set(opts?.expandedReels ?? []);

    // Apply expanding wilds: fill whole reel with wild visuals.
    const displayBoard = this.board.map((col, reel) =>
      expanded.has(reel) ? col.map(() => wildSymbolId) : col
    );

    // Free-spin reveals arrive with the reels already stopped (the base spin
    // settled them and nothing re-emits `reels:spin`). Kick any idle reel back
    // into motion and clear the previous board's win highlights, so every free
    // spin visibly spins to its result instead of silently snapping the board.
    const turbo = opts?.turbo ?? this.turbo;
    if (this.reels.some((reel) => !reel.spinning)) {
      this.clearHighlights();
      for (let r = 0; r < NUM_REELS; r++) {
        const reel = this.reels[r];
        if (reel.spinning) continue;
        reel.spinning = true;
        reel.speed = (turbo ? 3200 : 2400) + r * 80;
        reel.offset = 0;
      }
    }

    return new Promise<void>((resolve) => {
      this.spinResolve = resolve;
      const baseStop = this.elapsed;
      for (let r = 0; r < NUM_REELS; r++) {
        const reel = this.reels[r];
        reel.pendingBoard = displayBoard[r];
        // Staggered stop; later reels stop later (turbo compresses the cascade).
        // Anticipation extends reels 3-4.
        let delay = turbo ? 120 + r * 80 : 300 + r * 240;
        if (opts?.anticipation && r >= 3) delay += turbo ? 300 : 900;
        reel.stopAt = baseStop + delay;
      }
      // Mark multiplier badges to apply once stopped.
      this.pendingBadges = opts?.multiplierWilds ?? [];
      this.pendingExpanded = expanded;
      // A skip that arrived while the outcome was still unknown applies now.
      if (this.pendingSkip) {
        this.pendingSkip = false;
        this.skipToSettle();
      }
    });
  }

  private pendingBadges: Array<{ reel: number; row: number; value: number }> = [];
  private pendingExpanded: Set<number> = new Set();
  private turbo = false;
  private pendingSkip = false;

  /** Stop a reel immediately, snapping it to its pending symbols. */
  private settleReel(reel: ReelState, reelIndex: number): void {
    reel.spinning = false;
    reel.speed = 0;
    reel.offset = 0;
    const symbols = reel.pendingBoard ?? this.board[reelIndex] ?? [];
    // Cells 1..NUM_ROWS are the visible rows.
    for (let row = 0; row < NUM_ROWS; row++) {
      const cell = reel.cells[row + 1];
      this.setCellSymbol(cell, symbols[row] ?? 'L5');
      cell.container.y = row * CELL + SYMBOL_GAP / 2;
    }
    // Off-screen padding cells.
    this.setCellSymbol(reel.cells[0], symbols[0] ?? 'L5');
    reel.cells[0].container.y = -CELL + SYMBOL_GAP / 2;
    this.setCellSymbol(reel.cells[NUM_ROWS + 1], symbols[NUM_ROWS - 1] ?? 'L5');
    reel.cells[NUM_ROWS + 1].container.y = NUM_ROWS * CELL + SYMBOL_GAP / 2;

    // Apply multiplier-wild badges for this reel.
    for (const mw of this.pendingBadges) {
      if (mw.reel === reelIndex && mw.value > 1) {
        const cell = reel.cells[mw.row + 1];
        cell.badge.visible = true;
        cell.badgeText.text = `x${mw.value}`;
      }
    }
    // Pop animation on expanded reels.
    if (this.pendingExpanded.has(reelIndex)) {
      for (let row = 0; row < NUM_ROWS; row++) {
        reel.cells[row + 1].container.scale.set(1.08);
      }
    }
  }

  /**
   * Neon-tube payline stroke: a wide soft halo, a saturated mid pass and a hot
   * near-white core, so lines read as lit tubes rather than flat strokes.
   */
  private strokeNeon(points: number[], color: number): void {
    this.lineOverlay.poly(points, false).stroke({ color, width: 16, alpha: 0.18 });
    this.lineOverlay.poly(points, false).stroke({ color, width: 8, alpha: 0.55 });
    this.lineOverlay.poly(points, false).stroke({ color: 0xffffff, width: 3, alpha: 0.9 });
  }

  /** Additive glow flare over one winning cell, tinted to the symbol color. */
  private addCellGlow(reel: number, row: number, color: number): void {
    const tex = assetRegistry.getTexture('fx:cellGlow');
    if (!tex) return; // strokes/pulses still highlight the win without the art
    const glow = new Sprite(tex);
    glow.anchor.set(0.5);
    glow.width = CELL * 1.7;
    glow.height = CELL * 1.7;
    glow.x = reel * REEL_WIDTH + CELL / 2;
    glow.y = row * CELL + CELL / 2;
    glow.tint = color;
    glow.alpha = 0.85;
    glow.blendMode = 'add';
    this.glowLayer.addChild(glow);
  }

  /** Highlight wins: draw the payline for lines games, pulse the matching cells
   * across the winning reels for ways games, or pulse the exact connected cluster
   * cells for cluster games. Winning cells get an additive glow flare. */
  highlightWins(wins: Win[]): void {
    this.lineOverlay.clear();
    this.clearGlows();
    for (const win of wins) {
      const color = parseInt(getSymbolColor(win.symbol).replace('#', ''), 16);
      if ('line' in win) {
        const line = paylines[win.line];
        if (!line) continue;
        const points: number[] = [];
        for (let reel = 0; reel < win.count; reel++) {
          const row = line[reel];
          points.push(reel * REEL_WIDTH + CELL / 2, row * CELL + CELL / 2);
          const cell = this.reels[reel]?.cells[row + 1];
          if (cell) cell.container.scale.set(1.12);
          this.addCellGlow(reel, row, color);
        }
        this.strokeNeon(points, color);
      } else if ('cells' in win) {
        // Cluster win: pulse the connected cells the math reported and outline
        // each with a symbol-coloured rounded rect so the cluster reads as a group.
        for (const { reel, row } of win.cells) {
          const cell = this.reels[reel]?.cells[row + 1];
          if (cell) cell.container.scale.set(1.12);
          this.lineOverlay
            .roundRect(reel * REEL_WIDTH + 2, row * CELL + 2, CELL - 4, CELL - 4, 6)
            .stroke({ color, width: 4, alpha: 0.85 });
          this.addCellGlow(reel, row, color);
        }
      } else {
        // Ways win: pulse all matching (or wild) cells on the first `count` reels.
        for (let reel = 0; reel < win.count && reel < this.board.length; reel++) {
          for (let row = 0; row < NUM_ROWS; row++) {
            const sym = this.board[reel]?.[row];
            if (sym === win.symbol || sym === wildSymbolId) {
              const cell = this.reels[reel]?.cells[row + 1];
              if (cell) cell.container.scale.set(1.12);
              this.addCellGlow(reel, row, color);
            }
          }
        }
      }
    }
  }

  /** Remove and destroy the per-win glow sprites (textures are shared). */
  private clearGlows(): void {
    for (const glow of this.glowLayer.removeChildren()) glow.destroy();
  }

  /** Clear win-line overlays and reset cell scales. */
  clearHighlights(): void {
    this.lineOverlay.clear();
    this.clearGlows();
    for (const reel of this.reels) {
      for (const cell of reel.cells) {
        cell.container.scale.set(1);
        cell.badge.visible = false;
      }
    }
  }

  /** Advance the spin animation. Driven by the stage ticker. */
  update(ticker: Ticker): void {
    const dt = ticker.deltaMS / 1000;
    this.elapsed += ticker.deltaMS;
    let anyStillSpinning = false;

    for (let r = 0; r < NUM_REELS; r++) {
      const reel = this.reels[r];
      if (!reel.spinning) continue;
      anyStillSpinning = true;

      if (reel.pendingBoard && this.elapsed >= reel.stopAt) {
        this.settleReel(reel, r);
        // Anticipation: when a reel stops showing a scatter and we still spin.
        continue;
      }

      // Scroll the reel; recycle cells that pass the bottom edge.
      reel.offset += reel.speed * dt;
      const wrap = CELL;
      while (reel.offset >= wrap) {
        reel.offset -= wrap;
        // Shift symbols down by rotating the cell array's symbols.
        const last = reel.cells[reel.cells.length - 1];
        this.setCellSymbol(last, randomSpinSymbol());
        reel.cells.unshift(reel.cells.pop()!);
      }
      reel.cells.forEach((cell, i) => {
        cell.container.y = (i - 1) * CELL + SYMBOL_GAP / 2 + reel.offset;
      });
    }

    if (!anyStillSpinning && this.spinResolve) {
      const resolve = this.spinResolve;
      this.spinResolve = null;
      resolve();
    }
  }

  /** Resize/scale-to-fit hook (the stage positions this container). */
  layout(scale: number, x: number, y: number): void {
    this.view.scale.set(scale);
    this.view.x = x;
    this.view.y = y;
  }

  /** Tear down resources. */
  destroy(): void {
    for (const tex of this.textureCache.values()) {
      // Trimmed views share their source with the asset registry's texture —
      // destroy the view only, never the shared source. Procedural textures own
      // their source and are destroyed fully. Registry originals (untrimmed art)
      // stay alive for the registry.
      if (this.trimmedViews.has(tex)) tex.destroy(false);
      else if (this.ownedTextures.has(tex)) tex.destroy(true);
    }
    this.textureCache.clear();
    this.trimmedViews.clear();
    this.ownedTextures.clear();
    this.view.destroy({ children: true });
  }
}

/** Glyph label for a symbol id (short, readable on the tile). */
function labelFor(symbolId: string): string {
  if (symbolId === wildSymbolId) return 'W';
  if (symbolId === scatterSymbolId) return '★';
  return symbolId;
}

/**
 * A view over `texture` cropped to its alpha bounding box (with a small halo
 * margin), sharing the same GPU source. Returns the original texture when the
 * pixels can't be read (no DOM canvas, cross-origin) or the trim would be a
 * no-op — the caller falls back to the untrimmed plate either way.
 */
function trimTexture(texture: Texture): Texture {
  try {
    if (typeof document === 'undefined') return texture;
    const source = texture.source.resource as CanvasImageSource | null | undefined;
    if (!source) return texture;
    const w = texture.source.pixelWidth;
    const h = texture.source.pixelHeight;
    if (!w || !h) return texture;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return texture;
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return texture; // fully transparent — keep the plate as-is
    const pad = Math.round(Math.min(w, h) * 0.02); // keep a soft-glow margin
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    if (cw >= w - 2 && ch >= h - 2) return texture; // nothing worth trimming
    return new Texture({ source: texture.source, frame: new Rectangle(minX, minY, cw, ch) });
  } catch {
    return texture;
  }
}

/** A weighted-ish random symbol used only for the spinning blur fill. */
function randomSpinSymbol(): string {
  const pool = ['L1', 'L2', 'L3', 'L4', 'L5', 'H1', 'H2', 'H3', 'H4', 'W', 'S'];
  return pool[Math.floor(Math.random() * pool.length)];
}
