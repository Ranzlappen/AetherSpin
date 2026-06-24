/**
 * 5x3 reel renderer with procedural symbol textures (no external art), smooth
 * spin, staggered reel stops, anticipation on the final reels, win-line
 * highlighting, expanding wilds and multiplier-wild badges.
 *
 * Symbols are drawn procedurally from each symbol's definition color + letter, so
 * the game runs with zero art assets. Pixi-only; it reacts to intents emitted on
 * the shared event bus.
 */
import { Container, Graphics, Text, TextStyle, Texture, Sprite, type Renderer, type Ticker } from 'pixi.js';
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

const SYMBOL_SIZE = 132;
const SYMBOL_GAP = 8;
const CELL = SYMBOL_SIZE + SYMBOL_GAP;
const REEL_WIDTH = CELL;
const BOARD_WIDTH = REEL_WIDTH * NUM_REELS;
const BOARD_HEIGHT = CELL * NUM_ROWS;

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
  private readonly maskGfx = new Graphics();
  private readonly frame = new Graphics();
  private readonly lineOverlay = new Graphics();
  private readonly textureCache = new Map<string, Texture>();
  private readonly renderer: Renderer;
  private elapsed = 0;
  private board: Board = [];
  private spinResolve: (() => void) | null = null;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.buildFrame();
    this.buildReels();
    this.view.addChild(this.lineOverlay);
    this.applyMask();
    this.subscribe();
  }

  /** Width/height of the reel board in pixels (for layout). */
  get boardSize(): { width: number; height: number } {
    return { width: BOARD_WIDTH, height: BOARD_HEIGHT };
  }

  /** Build the neon frame around the reels. */
  private buildFrame(): void {
    this.frame
      .roundRect(-12, -12, BOARD_WIDTH + 24, BOARD_HEIGHT + 24, 18)
      .stroke({ color: 0x7df9ff, width: 3, alpha: 0.8 });
    this.frame
      .roundRect(-6, -6, BOARD_WIDTH + 12, BOARD_HEIGHT + 12, 14)
      .fill({ color: 0x0a0420, alpha: 0.55 });
    this.view.addChild(this.frame);
  }

  /** Construct every reel and cell with placeholder symbols. */
  private buildReels(): void {
    for (let r = 0; r < NUM_REELS; r++) {
      const reelContainer = new Container();
      reelContainer.x = r * REEL_WIDTH;
      this.view.addChild(reelContainer);
      const cells: Cell[] = [];
      // One extra cell above and below for seamless spin scroll.
      for (let row = 0; row < NUM_ROWS + 2; row++) {
        const cell = this.makeCell('L5');
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
    for (let r = 0; r < NUM_REELS; r++) {
      (this.view.getChildAt(2 + r) as Container).mask = this.maskGfx;
    }
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

  /** Generate (and cache) a tile texture for a symbol id. */
  private symbolTexture(symbolId: string): Texture {
    const cached = this.textureCache.get(symbolId);
    if (cached) return cached;
    const color = parseInt(getSymbolColor(symbolId).replace('#', ''), 16);
    const g = new Graphics();
    g.roundRect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE, 14).fill({ color: 0x0d0726 });
    g.roundRect(3, 3, SYMBOL_SIZE - 6, SYMBOL_SIZE - 6, 12).fill({ color, alpha: 0.16 });
    g.roundRect(3, 3, SYMBOL_SIZE - 6, SYMBOL_SIZE - 6, 12).stroke({ color, width: 3, alpha: 0.9 });
    const tex = this.renderer.generateTexture(g);
    g.destroy();
    this.textureCache.set(symbolId, tex);
    return tex;
  }

  /** Render a symbol into a cell (tile sprite + glyph letter). */
  private setCellSymbol(cell: Cell, symbolId: string): void {
    cell.symbolId = symbolId;
    cell.bg.clear();
    // Use a sprite from the cached texture for the tile background.
    cell.bg.removeChildren();
    const tile = new Sprite(this.symbolTexture(symbolId));
    cell.bg.addChild(tile);

    const meta = getSymbol(symbolId);
    const color = getSymbolColor(symbolId);
    cell.glyph.text = labelFor(symbolId);
    cell.glyph.style.fill = color;
    cell.glyph.style.fontSize = meta?.kind === 'low' ? 44 : 52;
    cell.badge.visible = false;
  }

  /** Subscribe to bus intents. */
  private subscribe(): void {
    bus.on('reels:spin', () => this.startSpin());
    bus.on('board:reveal', (p) => this.revealBoard(p.board, p));
    bus.on('wins:lines', (p) => this.highlightWins(p.wins));
  }

  /** Begin spinning every reel; returns when all reels are at full speed. */
  startSpin(): void {
    this.clearHighlights();
    for (let r = 0; r < NUM_REELS; r++) {
      const reel = this.reels[r];
      reel.spinning = true;
      reel.speed = 2400 + r * 80;
      reel.pendingBoard = null;
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
    }
  ): Promise<void> {
    this.board = board.map((col) => [...col]);
    const expanded = new Set(opts?.expandedReels ?? []);

    // Apply expanding wilds: fill whole reel with wild visuals.
    const displayBoard = this.board.map((col, reel) =>
      expanded.has(reel) ? col.map(() => wildSymbolId) : col
    );

    return new Promise<void>((resolve) => {
      this.spinResolve = resolve;
      const baseStop = this.elapsed;
      for (let r = 0; r < NUM_REELS; r++) {
        const reel = this.reels[r];
        reel.pendingBoard = displayBoard[r];
        // Staggered stop; later reels stop later. Anticipation extends reels 3-4.
        let delay = 300 + r * 240;
        if (opts?.anticipation && r >= 3) delay += 900;
        reel.stopAt = baseStop + delay;
      }
      // Mark multiplier badges to apply once stopped.
      this.pendingBadges = opts?.multiplierWilds ?? [];
      this.pendingExpanded = expanded;
    });
  }

  private pendingBadges: Array<{ reel: number; row: number; value: number }> = [];
  private pendingExpanded: Set<number> = new Set();

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

  /** Highlight wins: draw the payline for lines games, or pulse every matching
   * symbol cell across the winning reels for ways games. */
  highlightWins(wins: Win[]): void {
    this.lineOverlay.clear();
    for (const win of wins) {
      if ('line' in win) {
        const line = paylines[win.line];
        if (!line) continue;
        const color = parseInt(getSymbolColor(win.symbol).replace('#', ''), 16);
        const points: number[] = [];
        for (let reel = 0; reel < win.count; reel++) {
          const row = line[reel];
          points.push(reel * REEL_WIDTH + CELL / 2, row * CELL + CELL / 2);
          const cell = this.reels[reel]?.cells[row + 1];
          if (cell) cell.container.scale.set(1.12);
        }
        this.lineOverlay.poly(points, false).stroke({ color, width: 5, alpha: 0.85 });
      } else {
        // Ways win: pulse all matching (or wild) cells on the first `count` reels.
        for (let reel = 0; reel < win.count && reel < this.board.length; reel++) {
          for (let row = 0; row < NUM_ROWS; row++) {
            const sym = this.board[reel]?.[row];
            if (sym === win.symbol || sym === wildSymbolId) {
              const cell = this.reels[reel]?.cells[row + 1];
              if (cell) cell.container.scale.set(1.12);
            }
          }
        }
      }
    }
  }

  /** Clear win-line overlays and reset cell scales. */
  clearHighlights(): void {
    this.lineOverlay.clear();
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
    for (const tex of this.textureCache.values()) tex.destroy(true);
    this.textureCache.clear();
    this.view.destroy({ children: true });
  }
}

/** Glyph label for a symbol id (short, readable on the tile). */
function labelFor(symbolId: string): string {
  if (symbolId === wildSymbolId) return 'W';
  if (symbolId === scatterSymbolId) return '★';
  return symbolId;
}

/** A weighted-ish random symbol used only for the spinning blur fill. */
function randomSpinSymbol(): string {
  const pool = ['L1', 'L2', 'L3', 'L4', 'L5', 'H1', 'H2', 'H3', 'H4', 'W', 'S'];
  return pool[Math.floor(Math.random() * pool.length)];
}
