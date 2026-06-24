<script lang="ts">
  /**
   * Compliance-friendly paytable: renders symbol payouts, paylines and feature
   * rules straight from the game definition (no hard-coded numbers).
   */
  import {
    gameDefinition,
    paylines,
    getSymbol,
    getSymbolColor,
    NUM_REELS,
    NUM_ROWS,
    formatMultiplier,
  } from '../config/gameConfig';
  import { t } from '../core/i18n';

  export let open = false;
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ close: void }>();

  function close(): void {
    dispatch('close');
  }

  const paySymbols = gameDefinition.symbols.filter((s) => gameDefinition.paytable[s.id] !== undefined);
  const counts = ['3', '4', '5'];
  const scatter = gameDefinition.scatter;
  const features = gameDefinition.features;

  /** Build a small grid preview for a single payline. */
  function lineCells(line: number[]): boolean[][] {
    const grid: boolean[][] = Array.from({ length: NUM_ROWS }, () =>
      Array.from({ length: NUM_REELS }, () => false)
    );
    line.forEach((row, reel) => {
      if (grid[row]) grid[row][reel] = true;
    });
    return grid;
  }
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true" aria-label={$t('paytable.open')}>
    <button class="backdrop" aria-label={$t('paytable.close')} on:click={close}></button>
    <div class="modal panel">
      <header>
        <h2 class="neon-text">{gameDefinition.displayName} — {$t('paytable.open')}</h2>
        <button class="close" aria-label={$t('common.close')} on:click={close}>✕</button>
      </header>

      <div class="content">
        <p class="desc">{gameDefinition.description}</p>

        <section>
          <h3>{$t('paytable.title')}</h3>
          <p class="sub">{$t('paytable.subtitle')}</p>
          <div class="pay-grid">
            <div class="pay-head">{$t('paytable.symbol')}</div>
            {#each counts as c (c)}<div class="pay-head">{c} of a kind</div>{/each}
            {#each paySymbols as sym (sym.id)}
              <div class="sym">
                <span class="chip" style:background={getSymbolColor(sym.id)}></span>
                <span class="sym-name">{sym.name}</span>
              </div>
              {#each counts as c (c)}
                <div class="pay-val">
                  {gameDefinition.paytable[sym.id][c]
                    ? formatMultiplier(gameDefinition.paytable[sym.id][c])
                    : '—'}
                </div>
              {/each}
            {/each}
          </div>
        </section>

        <section>
          <h3>Scatter — {getSymbol(scatter.symbol)?.name ?? scatter.symbol}</h3>
          <p class="sub">
            Pays anywhere. {scatter.minToTrigger}+ trigger free spins.
          </p>
          <div class="scatter-pays">
            {#each Object.entries(scatter.pays) as [count, mult] (count)}
              <div class="scatter-pay">
                <strong>{count}×</strong>
                {formatMultiplier(mult)}
              </div>
            {/each}
          </div>
        </section>

        <section>
          <h3>{$t('paytable.features')}</h3>
          <ul class="rules">
            <li>
              <strong>Free Spins:</strong> Land {scatter.minToTrigger}+ scatters to win
              {features.freeSpins.awards['3']}–{features.freeSpins.awards['5']} spins.
              {#if features.freeSpins.retrigger}Retriggers award more spins.{/if}
            </li>
            <li>
              <strong>Multiplier Ladder:</strong>
              {features.freeSpins.multiplierLadder.description}
              (x{features.freeSpins.multiplierLadder.start} up to x{features.freeSpins.multiplierLadder.max}).
            </li>
            <li>
              <strong>Multiplier Wilds:</strong> In free spins, wilds carry
              {features.multiplierWilds.values.join('× / ')}× multipliers.
            </li>
            <li>
              <strong>Expanding Wilds:</strong>
              {features.expandingWilds.description}
            </li>
            <li>
              <strong>Buy Bonus:</strong>
              {features.bonusBuy.description}
            </li>
          </ul>
        </section>

        <section>
          <h3>Paylines ({paylines.length})</h3>
          <div class="lines">
            {#each paylines as line, i (i)}
              <div class="line-card">
                <span class="line-no">#{i + 1}</span>
                <div class="mini-grid" style:grid-template-columns={`repeat(${NUM_REELS}, 1fr)`}>
                  {#each lineCells(line) as rowCells, r (r)}
                    {#each rowCells as on, c (c)}
                      <span class="dot" class:on></span>
                    {/each}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>

        <p class="rtp">
          Theoretical RTP: {(gameDefinition.engine.rtpTarget * 100).toFixed(2)}% · Max win: {gameDefinition.engine.wincapMultiplier.toLocaleString()}×
          · Volatility: {gameDefinition.engine.volatility}
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 0, 10, 0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 80;
    padding: 1rem;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    cursor: default;
  }
  .modal {
    position: relative;
    z-index: 1;
    width: min(720px, 96vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    border-color: var(--neon-cyan);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.2rem;
    border-bottom: 1px solid rgba(125, 249, 255, 0.2);
  }
  header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--neon-cyan);
  }
  .close {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(125, 249, 255, 0.4);
    font-size: 1rem;
  }
  .content {
    overflow-y: auto;
    padding: 1.2rem;
  }
  .desc {
    color: var(--text-dim);
    line-height: 1.5;
    margin-top: 0;
  }
  section {
    margin-bottom: 1.6rem;
  }
  h3 {
    color: var(--neon-magenta);
    margin: 0 0 0.3rem;
  }
  .sub {
    color: var(--text-dim);
    font-size: 0.8rem;
    margin: 0 0 0.6rem;
  }
  .pay-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 0.3rem 0.6rem;
    align-items: center;
  }
  .pay-head {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    border-bottom: 1px solid rgba(125, 249, 255, 0.15);
    padding-bottom: 0.2rem;
  }
  .sym {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .chip {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    box-shadow: 0 0 8px currentColor;
  }
  .sym-name {
    font-size: 0.85rem;
  }
  .pay-val {
    font-weight: 700;
    color: var(--neon-gold);
    font-size: 0.9rem;
  }
  .scatter-pays {
    display: flex;
    gap: 1rem;
  }
  .scatter-pay {
    color: var(--neon-gold);
  }
  .rules {
    margin: 0;
    padding-left: 1.1rem;
    line-height: 1.55;
    font-size: 0.88rem;
  }
  .rules strong {
    color: var(--neon-cyan);
  }
  .lines {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.6rem;
  }
  .line-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem;
    border: 1px solid rgba(125, 249, 255, 0.15);
    border-radius: 8px;
  }
  .line-no {
    font-size: 0.7rem;
    color: var(--text-dim);
  }
  .mini-grid {
    display: grid;
    gap: 2px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: rgba(125, 249, 255, 0.12);
  }
  .dot.on {
    background: var(--neon-magenta);
    box-shadow: 0 0 6px var(--neon-magenta);
  }
  .rtp {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.78rem;
    border-top: 1px solid rgba(125, 249, 255, 0.15);
    padding-top: 0.8rem;
  }
</style>
