<script lang="ts">
  /**
   * Autoplay control: pick a spin count plus responsible-gaming limits (loss
   * limit and single-win limit, expressed as multiples of the current bet),
   * or stop an active run. Limits are dispatched in dollars.
   */
  import { autoplay, isSpinning, insufficientFunds, currentBet, currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import { t, localeTag } from '../core/i18n';
  import { createEventDispatcher } from 'svelte';
  import type { AutoplayRunOptions } from '../core/autoplay';

  const dispatch = createEventDispatcher<{ start: AutoplayRunOptions; stop: void }>();
  const counts = [10, 25, 50, 100];
  /** Limit presets as multiples of the current bet; null = no limit. */
  const lossLimitSteps: Array<number | null> = [10, 20, 50, null];
  const winLimitSteps: Array<number | null> = [10, 25, 50, null];

  let open = false;
  // Jurisdiction-friendly defaults: loss limit ON (20× bet), win limit off.
  let lossLimitMult: number | null = 20;
  let singleWinLimitMult: number | null = null;
  let stopOnFeature = true;

  function limitLabel(mult: number | null): string {
    return mult === null ? $t('autoplay.off') : formatCurrency(mult * $currentBet, $currency, $localeTag);
  }

  function start(count: number): void {
    open = false;
    dispatch('start', {
      count,
      stopOnFeature,
      lossLimit: lossLimitMult === null ? null : lossLimitMult * $currentBet,
      singleWinLimit: singleWinLimitMult === null ? null : singleWinLimitMult * $currentBet,
    });
  }
  function stop(): void {
    dispatch('stop');
  }
</script>

<div class="autoplay">
  {#if $autoplay.active}
    <button class="btn stop" aria-label={$t('autoplay.stop')} on:click={stop}>
      {$t('autoplay.stopShort')}
      <span class="count">{$autoplay.remaining === Infinity ? '∞' : $autoplay.remaining}</span>
    </button>
  {:else}
    <button
      class="btn"
      aria-label={$t('autoplay.label')}
      aria-expanded={open}
      disabled={$isSpinning || $insufficientFunds}
      on:click={() => (open = !open)}>{$t('autoplay.auto')} ▾</button
    >
    {#if open}
      <div class="menu panel" role="group" aria-label={$t('autoplay.label')}>
        <fieldset>
          <legend>{$t('autoplay.lossLimit')}</legend>
          <div class="options">
            {#each lossLimitSteps as step (String(step))}
              <button
                class="opt"
                class:selected={lossLimitMult === step}
                aria-pressed={lossLimitMult === step}
                on:click={() => (lossLimitMult = step)}
              >
                {limitLabel(step)}
              </button>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend>{$t('autoplay.singleWinLimit')}</legend>
          <div class="options">
            {#each winLimitSteps as step (String(step))}
              <button
                class="opt"
                class:selected={singleWinLimitMult === step}
                aria-pressed={singleWinLimitMult === step}
                on:click={() => (singleWinLimitMult = step)}
              >
                {limitLabel(step)}
              </button>
            {/each}
          </div>
        </fieldset>

        <label class="feature-stop">
          <input type="checkbox" bind:checked={stopOnFeature} />
          {$t('autoplay.stopOnFeature')}
        </label>

        <fieldset>
          <legend>{$t('autoplay.spinsLegend')}</legend>
          <div class="options">
            {#each counts as c (c)}
              <button class="opt go" on:click={() => start(c)}>{c}</button>
            {/each}
          </div>
        </fieldset>
      </div>
    {/if}
  {/if}
</div>

<style>
  .autoplay {
    position: relative;
  }
  .stop {
    border-color: var(--danger);
    background: linear-gradient(180deg, rgba(255, 84, 112, 0.28), rgba(255, 84, 112, 0.06));
  }
  .count {
    font-weight: 800;
    color: var(--neon-gold);
  }
  .menu {
    position: absolute;
    bottom: calc(100% + 0.4rem);
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem;
    z-index: 20;
    min-width: 240px;
  }
  fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }
  legend {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    padding: 0 0 0.25rem;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.3rem;
  }
  .opt {
    padding: 0.35rem 0.4rem;
    border-radius: 8px;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(125, 249, 255, 0.08);
    font-weight: 700;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .opt:hover {
    background: rgba(125, 249, 255, 0.18);
  }
  .opt.selected {
    border-color: var(--neon-gold);
    background: rgba(255, 200, 60, 0.16);
    color: var(--neon-gold);
  }
  .opt.go {
    border-color: var(--neon-magenta);
    background: rgba(255, 69, 224, 0.12);
  }
  .opt.go:hover {
    background: rgba(255, 69, 224, 0.24);
  }
  .feature-stop {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
